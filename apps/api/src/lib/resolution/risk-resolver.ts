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
    `You are an expert at editing execution prompts for software projects.`,
    ``,
    `A risk has been resolved. Edit the prompt below so that it describes the POST-MITIGATION state (the solution is now in place).`,
    ``,
    `Rules:`,
    `- Read the FULL prompt first to understand context across all sections`,
    `- Rewrite ONLY the sentences that reference the resolved risk(s)`,
    `- Describe the solution as IMPLEMENTED, not as a problem to solve`,
    `- Do NOT change sections or sentences unrelated to the resolved risk(s)`,
    `- Keep ALL markdown headings, structure, and formatting identical`,
    `- Preserve all section boundaries (## Objective, ## Context, ## Constraints, etc.)`,
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

export async function resolveRisks(
  resolutions: RiskResolution[],
  allPrompts: PromptArtifact[],
  router: RouterService,
  preferences?: UserPreferences,
): Promise<ResolveResult> {
  // Step 1: Extract keywords from ALL selected risks
  const allKeywords = new Set<string>();
  for (const r of resolutions) {
    for (const kw of extractKeywords(r.description)) {
      allKeywords.add(kw);
    }
  }

  if (allKeywords.size === 0) {
    return { rewrittenPrompts: [], failedPrompts: [] };
  }

  // Step 2: Find matching prompts
  const matchingPrompts = findMatchingPrompts(allPrompts, [...allKeywords]);
  log.info({ keywordCount: allKeywords.size, matchingCount: matchingPrompts.length, totalPrompts: allPrompts.length }, "risk_resolve_search");

  if (matchingPrompts.length === 0) {
    return { rewrittenPrompts: [], failedPrompts: [] };
  }

  // Step 3: Rewrite each matching prompt
  const rewrittenPrompts: { taskId: string; newText: string }[] = [];
  const failedPrompts: string[] = [];

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

  return { rewrittenPrompts, failedPrompts };
}
