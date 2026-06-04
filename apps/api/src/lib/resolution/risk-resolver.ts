import type { AIProvider, GenerationInput, Message } from "../provider/types.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import { OpencodeGoProvider } from "../provider/opencode-go.js";
import type { RouterService } from "../router/router.js";
import type { RouterDecision, ModelSelection, UserPreferences } from "../router/types.js";
import { getCredentialStore, decryptKey } from "../credentials/store.js";
import { generateWithRetry } from "../generation/ai-generator.js";
import type { PromptArtifact } from "../prompt/types.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("risk-resolver");

export interface RiskResolution {
  id: string;
  description: string;
}

export interface ResolveResult {
  rewrittenPrompts: { taskId: string; newText: string }[];
  failedPrompts: string[];
  updatedSummary: Record<string, unknown> | null;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "at", "for", "by", "with",
  "and", "or", "but", "not", "no", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "this", "that", "these", "those", "it", "its", "they", "them", "their",
  "we", "our", "you", "your", "he", "she", "him", "her", "his",
  "from", "as", "into", "over", "such", "each", "about", "than", "also",
  "very", "just", "quite", "too", "more", "most", "some", "any", "all",
  "both", "each", "few", "more", "most", "other", "some", "such", "no",
  "nor", "only", "own", "same", "so", "too", "very", "just",
  "because", "before", "after", "between", "under", "above", "below",
  "leads", "lead", "leading", "creates", "create", "creating", "causes",
  "cause", "causing", "result", "results", "resulting", "potential",
  "risk", "risks", "issue", "issues", "lack", "lacking", "without",
]);

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

function findMatchingPrompts(
  prompts: PromptArtifact[],
  keywords: string[],
): PromptArtifact[] {
  if (keywords.length === 0) return [];
  return prompts.filter((p) => {
    const text = p.promptText.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });
}

function createProvider(selection: ModelSelection): AIProvider | undefined {
  const credStore = getCredentialStore();
  const allCreds = credStore.list();
  const cred = allCreds.find((c) => c.provider === selection.provider);
  if (!cred) return undefined;
  const raw = credStore.getRaw(cred.id);
  if (!raw?.encryptedApiKey) return undefined;
  const apiKey = decryptKey(raw.encryptedApiKey);
  if (!apiKey) return undefined;

  switch (selection.provider) {
    case "openai": return new OpenAIProvider(apiKey);
    case "anthropic": return new AnthropicProvider(apiKey);
    case "openrouter": return new OpenRouterProvider(apiKey);
    case "opencode-go": return new OpencodeGoProvider(apiKey);
    default: return undefined;
  }
}

async function rewriteSinglePrompt(
  prompt: PromptArtifact,
  resolutions: RiskResolution[],
  router: RouterService,
  preferences?: UserPreferences,
): Promise<string | null> {
  const resolutionLines = resolutions
    .map((r) => `  - ${r.id}: ${r.description}`)
    .join("\n");

  const systemPrompt = [
    `You are editing execution prompts for a software project plan.`,
    ``,
    `A RISK was identified — something that was WRONG or MISSING in the plan.`,
    `The user wants to MITIGATE it, meaning they want it RESOLVED.`,
    `The OPPOSITE of the risk is now the new reality.`,
    ``,
    `Example:`,
    `  Risk: "No user authentication"`,
    `  → RESOLVED: "Project NOW HAS authentication implemented"`,
    `  Risk: "No test coverage"`,
    `  → RESOLVED: "Project NOW HAS comprehensive testing"`,
    `  Risk: "Slow database queries"`,
    `  → RESOLVED: "Queries are optimized for performance"`,
    ``,
    `Your job:`,
    `1. Read the resolved risk(s) below`,
    `2. Read the full prompt (all sections)`,
    `3. DECIDE if this prompt is related to the resolved risk`,
    `4. If YES → rewrite sentences that describe the OLD problem`,
    `   to describe the NEW correct state (the opposite of the risk)`,
    `5. If NO → return the prompt unchanged — some prompts are genuinely unrelated`,
    ``,
    `You are the judge of relevance, not a keyword filter.`,
    `Be generous in your judgment — if the prompt touches security, auth,`,
    `access control, users, permissions, API keys, data protection, or`,
    `similar concepts, it IS related. Only skip if clearly unrelated.`,
    ``,
    `Rules when rewriting:`,
    `- Change ONLY the sentences describing the old problem`,
    `- Describe the solution as IMPLEMENTED (the opposite of the risk)`,
    `- Keep all sections, headings, structure, and formatting identical`,
    `- Do NOT change sentences unrelated to the resolved risk`,
    `- Output ONLY the updated markdown — no extra text, no code fences`,
    ``,
    `Resolved risk(s):`,
    resolutionLines,
  ].join("\n");

  const userContent = [
    `=== PROMPT TO EDIT ===`,
    prompt.promptText,
  ].join("\n");

  const messages: Message[] = [{ role: "user" as const, content: userContent }];

  let currentDecision: RouterDecision;
  try {
    currentDecision = router.select("blueprint", preferences);
  } catch {
    return null;
  }

  const MAX_ATTEMPTS = 2;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sel = currentDecision.selection;
    const provider = createProvider(sel);
    if (!provider) {
      if (currentDecision.fallbackChain.length === 0) break;
      currentDecision = {
        ...currentDecision,
        selection: currentDecision.fallbackChain[0]!,
        fallbackChain: currentDecision.fallbackChain.slice(1),
        usedFallback: true,
      };
      continue;
    }

    const input: GenerationInput = {
      model: sel.model,
      systemPrompt,
      messages,
      temperature: 0.3,
    };

    try {
      const result = await generateWithRetry(() => createProvider(sel), input);
      const rewritten = result.content.trim();

      // Strip code fences if the AI wraps the output
      const fenceMatch = rewritten.match(/```(?:markdown)?\s*([\s\S]*?)```/);
      const clean = fenceMatch ? fenceMatch[1]!.trim() : rewritten;

      if (clean.length < 100) {
        log.warn({ taskId: prompt.taskId, length: clean.length }, "rewrite_too_short");
        if (currentDecision.fallbackChain.length === 0) break;
        currentDecision = {
          ...currentDecision,
          selection: currentDecision.fallbackChain[0]!,
          fallbackChain: currentDecision.fallbackChain.slice(1),
          usedFallback: true,
        };
        continue;
      }

      return clean;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err, taskId: prompt.taskId }, "rewrite_error");
      if (currentDecision.fallbackChain.length === 0) break;
      currentDecision = {
        ...currentDecision,
        selection: currentDecision.fallbackChain[0]!,
        fallbackChain: currentDecision.fallbackChain.slice(1),
        usedFallback: true,
      };
    }
  }

  return null;
}

async function rewriteProjectSummary(
  summary: Record<string, unknown>,
  resolutions: RiskResolution[],
  router: RouterService,
  preferences?: UserPreferences,
): Promise<Record<string, unknown> | null> {
  const resolutionLines = resolutions
    .map((r) => `  - ${r.id}: ${r.description}`)
    .join("\n");

  const systemPrompt = [
    `You are editing a project summary. One or more risks have been RESOLVED.`,
    `The summary on the plan page must reflect the new state.`,
    ``,
    `Resolved risk(s):`,
    resolutionLines,
    ``,
    `Current summary:`,
    JSON.stringify(summary, null, 2),
    ``,
    `For EACH of the 6 fields below, decide if it needs updating:`,
    ``,
    `1. projectOverview (string):`,
    `   A 2-3 sentence paragraph describing what the project does.`,
    `   Does the resolved risk affect the overall description?`,
    `   YES → rewrite the affected sentence. Keep unaffected sentences.`,
    `   NO  → return the string EXACTLY as-is, character-for-character.`,
    ``,
    `2. keyFeatures (array of strings):`,
    `   Does the mitigation introduce or modify a feature?`,
    `   Example: "no auth" resolved → add "JWT authentication" to features.`,
    `   YES → add or update the relevant item. Do NOT remove existing items.`,
    `   NO  → return the array EXACTLY as-is with the SAME items.`,
    ``,
    `3. technicalConstraints (array of strings):`,
    `   Does the mitigation lift or add a constraint?`,
    `   YES → update the relevant item(s) only.`,
    `   NO  → return the array EXACTLY as-is.`,
    ``,
    `4. businessConditions (array of strings):`,
    `   Does the mitigation affect any business condition?`,
    `   YES → update the relevant item(s) only.`,
    `   NO  → return the array EXACTLY as-is.`,
    ``,
    `5. architectureHighlights (array of strings):`,
    `   Does the mitigation affect the architecture?`,
    `   Example: "no auth" resolved → add "JWT auth middleware" to highlights.`,
    `   YES → add or update the relevant item. Do NOT remove existing items.`,
    `   NO  → return the array EXACTLY as-is.`,
    ``,
    `6. riskSummary (string):`,
    `   Does the resolved risk appear in this summary?`,
    `   YES → remove that sentence. Keep sentences about UNRESOLVED risks.`,
    `         If this was the ONLY risk mentioned, rewrite to say`,
    `         "Key risks have been addressed" or remove it entirely.`,
    `   NO  → return the string EXACTLY as-is.`,
    ``,
    `CRITICAL RULES:`,
    `1. NEVER change a field unrelated to the resolved risk(s).`,
    `2. NEVER add generic claims — only add specific mitigations.`,
    `3. NEVER remove content that is still valid and unrelated.`,
    `4. For arrays: return items in the SAME ORDER, with relevant changes only.`,
    `5. If NO field needs updating, return the EXACT input JSON unchanged.`,
    `6. Output ONLY the JSON with the 6 fields. No markdown fences, no explanations.`,
  ].join("\n");

  const userContent = [
    `Update the project summary above to reflect the resolved risk(s).`,
    `Return ONLY the updated JSON.`,
  ].join("\n");

  const messages: Message[] = [{ role: "user" as const, content: userContent }];

  let currentDecision: RouterDecision;
  try {
    currentDecision = router.select("blueprint", preferences);
  } catch {
    return null;
  }

  const MAX_ATTEMPTS = 2;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sel = currentDecision.selection;
    const provider = createProvider(sel);
    if (!provider) {
      if (currentDecision.fallbackChain.length === 0) break;
      currentDecision = {
        ...currentDecision,
        selection: currentDecision.fallbackChain[0]!,
        fallbackChain: currentDecision.fallbackChain.slice(1),
        usedFallback: true,
      };
      continue;
    }

    const input: GenerationInput = {
      model: sel.model,
      systemPrompt,
      messages,
      temperature: 0.3,
    };

    try {
      const result = await generateWithRetry(() => createProvider(sel), input);
      const raw = result.content.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const clean = fenceMatch ? fenceMatch[1]!.trim() : raw;
      const parsed = JSON.parse(clean);

      if (!parsed || typeof parsed !== "object") return null;
      const requiredFields = ["projectOverview", "keyFeatures", "technicalConstraints", "businessConditions", "architectureHighlights", "riskSummary"];
      if (!requiredFields.every((f) => f in parsed)) return null;

      return parsed as Record<string, unknown>;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, "summary_rewrite_error");
      if (currentDecision.fallbackChain.length === 0) break;
      currentDecision = {
        ...currentDecision,
        selection: currentDecision.fallbackChain[0]!,
        fallbackChain: currentDecision.fallbackChain.slice(1),
        usedFallback: true,
      };
    }
  }

  return null;
}

export async function resolveRisks(
  resolutions: RiskResolution[],
  allPrompts: PromptArtifact[],
  router: RouterService,
  preferences?: UserPreferences,
  projectSummary?: Record<string, unknown> | null,
): Promise<ResolveResult> {
  // Step 1: Extract keywords from ALL selected risks
  const allKeywords = new Set<string>();
  for (const r of resolutions) {
    for (const kw of extractKeywords(r.description)) {
      allKeywords.add(kw);
    }
  }

  let rewrittenPrompts: { taskId: string; newText: string }[] = [];
  const failedPrompts: string[] = [];
  let updatedSummary: Record<string, unknown> | null = null;

  // Rewrite project summary if present
  if (projectSummary) {
    const result = await rewriteProjectSummary(projectSummary, resolutions, router, preferences);
    if (result) {
      // Only use the updated summary if at least one field actually changed
      const summaryStr = JSON.stringify(result);
      const originalStr = JSON.stringify(projectSummary);
      if (summaryStr !== originalStr) {
        updatedSummary = result;
        log.info({}, "project_summary_rewritten");
      }
    }
  }

  // Step 2-3: Find and rewrite matching prompts (skip if no keywords)
  if (allKeywords.size > 0) {
    const matchingPrompts = findMatchingPrompts(allPrompts, [...allKeywords]);
    log.info({ keywordCount: allKeywords.size, matchingCount: matchingPrompts.length, totalPrompts: allPrompts.length }, "risk_resolve_search");

    if (matchingPrompts.length > 0) {
      rewrittenPrompts = [];
      for (const prompt of matchingPrompts) {
        const rewritten = await rewriteSinglePrompt(prompt, resolutions, router, preferences);
        if (rewritten) {
          rewrittenPrompts.push({ taskId: prompt.taskId, newText: rewritten });
          log.info({ taskId: prompt.taskId, riskCount: resolutions.length }, "prompt_rewritten");
        } else {
          failedPrompts.push(prompt.taskId);
          log.warn({ taskId: prompt.taskId }, "prompt_rewrite_failed_skipping");
        }
      }
    }
  }

  return { rewrittenPrompts, failedPrompts, updatedSummary };
}
