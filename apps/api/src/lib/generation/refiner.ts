import type { AIProvider, GenerationInput, Message } from "../provider/types.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import { OpencodeGoProvider } from "../provider/opencode-go.js";
import type { RouterService } from "../router/router.js";
import type { RouterDecision, ModelSelection, UserPreferences } from "../router/types.js";
import type { BlueprintOutput, RoadmapOutput } from "../contract/output-schema.js";
import {
  BlueprintOutputSchema, RoadmapOutputSchema, PHASE_ORDER,
} from "../contract/output-schema.js";
import { getCredentialStore, decryptKey } from "../credentials/store.js";
import { generateWithRetry } from "./ai-generator.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("refiner");

export interface RefineResult {
  blueprint: BlueprintOutput;
  roadmap: RoadmapOutput;
  changeSummary: string;
  provider?: string;
  model?: string;
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

function extractJson(content: string): Record<string, unknown> | null {
  let best: unknown = null;
  let bestSize = 0;
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const openIdx = content.indexOf("{", searchFrom);
    if (openIdx < 0) break;
    let depth = 0;
    let inString = false;
    let closeIdx = -1;
    for (let i = openIdx; i < content.length; i++) {
      const ch = content[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
      } else {
        if (ch === '"') inString = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { closeIdx = i; break; }
        }
      }
    }
    if (closeIdx < 0) break;
    const candidate = content.slice(openIdx, closeIdx + 1);
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === "object") {
        const hasPhases = (obj as Record<string, unknown>).phases !== undefined;
        const size = candidate.length;
        if (hasPhases && size > bestSize) { best = obj; bestSize = size; }
      }
    } catch { /* skip */ }
    searchFrom = openIdx + 1;
  }
  return best as Record<string, unknown> | null;
}

/**
 * Map a risk description to the most likely lifecycle phase(s) it affects.
 * Uses keyword matching against each phase's domain vocabulary.
 */
function riskToPhaseKeywords(text: string): string[] {
  const map: Record<string, string[]> = {
    security: ["auth", "authentication", "authorization", "encrypt", "vulnerability", "penetration", "compliance", "soc2", "gdpr", "hipaa", "access control", "permission", "secret leak", "api key", "oauth", "jwt"],
    architecture: ["scalab", "perform", "latency", "throughput", "microservice", "monolith", "coupling", "technical debt", "design flaw", "single point"],
    database: ["data loss", "backup", "recovery", "schema", "migration", "consistency", "integrity", "query", "storage"],
    testing: ["test cover", "bug", "regression", "qa", "quality", "manual test", "automated test"],
    deployment: ["ci/cd", "deploy", "rollback", "environ", "release", "pipeline", "staging", "production"],
    monitoring: ["monitor", "observability", "alert", "log", "trace", "metric", "dashboard", "incident"],
    backend: ["api", "endpoint", "server", "rate limit", "throttl", "middleware"],
    frontend: ["ui", "ux", "accessib", "responsive", "browser"],
    requirements: ["requirement", "scope creep", "ambigu", "stakeholder"],
    ideation: ["goal", "vision", "user need"],
    "core-features": ["feature", "functional", "mvp", "priority"],
    "ai-systems": ["ai", "ml", "model", "training", "inference"],
  };
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [phase, keywords] of Object.entries(map)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(phase);
    }
  }
  return matched.length > 0 ? matched : ["architecture"]; // default fallback
}

/**
 * Deterministic fallback: if the AI didn't update phase content for the
 * affected phases, append mitigation context directly to phase summaries.
 */
function repairPhaseContent(
  json: Record<string, unknown>,
  riskIds: string[],
  existingRisks: Record<string, unknown>[],
): void {
  const phases = json.phases as Record<string, unknown>[];
  if (!Array.isArray(phases)) return;

  const riskTexts = riskIds
    .map((id) => {
      const r = existingRisks.find((r) => r.id === id);
      return r?.description as string ?? "";
    })
    .filter(Boolean);
  if (riskTexts.length === 0) return;

  const affected = new Set<string>();
  for (const text of riskTexts) {
    for (const p of riskToPhaseKeywords(text)) {
      affected.add(p);
    }
  }

  for (const phase of phases) {
    const pt = phase.phaseType as string;
    if (!affected.has(pt)) continue;
    const summary = phase.summary as string;
    const mitigations = riskTexts.map((d) => {
      const m = d.match(/m\w+ by (.+)$/i);
      return m ? m[1]!.trim() : d;
    }).filter(Boolean);
    if (mitigations.length === 0) continue;
    const tag = `[Mitigated: ${mitigations.join("; ")}]`;
    if (!summary.includes("[Mitigated:")) {
      phase.summary = summary + (summary.endsWith(".") ? " " : ". ") + tag;
      log.info({ phaseType: pt, tag }, "phase_summary_repaired");
    }
  }
}

function computeChangeSummary(
  oldBlueprint: BlueprintOutput,
  newBlueprint: BlueprintOutput,
  riskIds: string[],
  relevantPhases: Set<string>,
): string {
  const changes: string[] = [];

  // Compare risks
  const oldRiskMap = new Map(oldBlueprint.risks.map((r) => [r.id, r]));
  const newRiskMap = new Map(newBlueprint.risks.map((r) => [r.id, r]));

  const addressed = riskIds.filter((id) => {
    const oldR = oldRiskMap.get(id);
    const newR = newRiskMap.get(id);
    if (!oldR) return false;
    if (!newR) return true;
    return oldR.description !== newR.description;
  });
  if (addressed.length > 0) {
    changes.push(`Addressed ${addressed.length} selected risk(s)`);
  }

  const removed = oldBlueprint.risks.filter((r) => !newRiskMap.has(r.id));
  if (removed.length > 0 && removed.some((r) => !riskIds.includes(r.id))) {
    changes.push(`Removed ${removed.filter((r) => !riskIds.includes(r.id)).length} additional risk(s)`);
  }

  const added = newBlueprint.risks.filter((r) => !oldRiskMap.has(r.id));
  if (added.length > 0) {
    changes.push(`Identified ${added.length} new risk(s)`);
  }

  // Compare overall confidence
  const confDiff = newBlueprint.overallConfidence - oldBlueprint.overallConfidence;
  if (Math.abs(confDiff) >= 0.05) {
    changes.push(`${confDiff > 0 ? "Increased" : "Decreased"} overall confidence by ${Math.abs(Math.round(confDiff * 100))}%`);
  }

  // Check which phases were updated
  const updatedPhases: string[] = [];
  for (const pt of relevantPhases) {
    const oldP = oldBlueprint.phases.find((p) => p.phaseType === pt);
    const newP = newBlueprint.phases.find((p) => p.phaseType === pt);
    if (oldP && newP && (oldP.summary !== newP.summary || oldP.narrative !== newP.narrative)) {
      updatedPhases.push(pt);
    }
  }
  if (updatedPhases.length > 0) {
    changes.push(`Updated ${updatedPhases.length} phase(s): ${updatedPhases.join(", ")}`);
  }

  if (changes.length === 0) {
    return "Minor adjustments to address selected risks.";
  }

  return changes.join(". ") + ".";
}

export async function refineBlueprint(
  existingRaw: Record<string, unknown>,
  riskIds: string[],
  planId: string,
  planVersion: number,
  projectId: string,
  sessionId: string,
  router: RouterService,
  preferences?: UserPreferences,
): Promise<RefineResult | null> {
  // Validate that risk IDs exist in the existing blueprint
  const existingRisks = (existingRaw.risks ?? []) as Record<string, unknown>[];
  const existingRiskIds = new Set(existingRisks.map((r) => r.id as string));
  for (const id of riskIds) {
    if (!existingRiskIds.has(id)) {
      log.warn({ riskId: id, availableIds: [...existingRiskIds] }, "refine_invalid_risk_id");
      return null;
    }
  }

  // Build prompt — structured to force AI to update BOTH risks AND phase content
  const systemPrompt = [
    `You are an AI planning assistant. The user has reviewed a plan and wants certain risks mitigated.`,
    `Revise the plan to reduce or mitigate the selected risks while preserving the original goals, scope, and intent as much as possible.`,
    `Do NOT remove or weaken features to eliminate a risk — propose mitigations instead.`,
    ``,
    `Output ONLY valid JSON with the same structure as the input blueprint.`,
    `IMPORTANT: Preserve all existing risk, assumption, and constraint IDs. Only create new IDs for NEW items you add.`,
    ``,
    `Top-level fields required:`,
    `- "phases": ARRAY of 12 objects in this exact order: ${PHASE_ORDER.join(", ")}`,
    `  Each phase object must contain: phaseType, phaseName, summary, narrative, status, confidence, keyDecisions, executionPrompt`,
    `- "assumptions": ARRAY of { id: string, description: string }`,
    `- "constraints": ARRAY of { id: string, description: string }`,
    `- "risks": ARRAY of { id: string, description: string }`,
    `- "overallConfidence": 0-1`,
    `- "overallSummary": string (min 20 chars)`,
    `- "roadmapPhases": ARRAY of 12 { phaseType, phaseName, order, effort, prerequisites }`,
    `- "totalEffort": "small"|"medium"|"large"`,
    ``,
    `CRITICAL — You MUST update BOTH arrays below, not just one:`,
    `  1. The "risks" array — update the selected risk descriptions with mitigations`,
    `  2. The "phases" array — update the phase(s) affected by each risk`,
    ``,
    `For each risk being mitigated, identify which lifecycle phase it belongs to, then:`,
    `  a) Rewrite that phase's "summary" to describe the post-mitigation state`,
    `     (e.g., "JWT authentication with RBAC" not "No auth implemented")`,
    `  b) Rewrite that phase's "narrative" to explain how the mitigation works`,
    `  c) Add mitigation-related items to that phase's "keyDecisions" array`,
    `  d) Rewrite that phase's "executionPrompt" (>1000 chars) as a detailed`,
    `     implementation guide that describes building the solution WITH mitigations`,
    `     - The executionPrompt describes what to CODE, not what to avoid`,
    `     - If the risk was "no auth", the prompt must say "implement JWT auth middleware"`,
    `     - NOT "consider adding auth" — tell the next AI what to build`,
    ``,
    `EXAMPLE:`,
    `  Risk: "No user authentication" → belongs to "security" phase`,
    `  BEFORE: summary="Basic security checklist", narrative="Consider auth options"`,
    `  AFTER:  summary="JWT authentication with RBAC, API key rotation, and audit logging"`,
    `          narrative="Authentication uses JWT tokens with role-based access control..."`,
    `          executionPrompt="## Objective\nImplement JWT authentication middleware..."`,
    ``,
    `FAILURE TO UPDATE PHASE CONTENT WILL CAUSE THE OUTPUT TO BE REJECTED.`,
    `The phase summaries, narratives, and executionPrompts MUST reflect the post-mitigation state.`,
  ].join("\n");

  const riskDetails = riskIds
    .map((id) => {
      const r = existingRisks.find((r) => r.id === id);
      if (!r) return `  - ${id} (not found)`;
      const desc = (r.description as string) ?? "";
      const phases = riskToPhaseKeywords(desc).join(", ");
      return `  - ${r.id}: ${desc} (affects: ${phases})`;
    })
    .join("\n");

  const userContent = [
    `=== EXISTING BLUEPRINT (v${planVersion}) ===`,
    JSON.stringify(existingRaw, null, 2),
    ``,
    `=== RISKS TO MITIGATE ===`,
    riskDetails,
    ``,
    `=== INSTRUCTIONS ===`,
    `For EACH risk listed above:`,
    `  1. Update its description in the "risks" array to include mitigation strategy`,
    `  2. Find the phase it affects (listed in parentheses)`,
    `  3. Rewrite that phase's summary, narrative, keyDecisions, and executionPrompt`,
    `     to describe the solution WITH the mitigation in place`,
    `  4. If a phase's executionPrompt already exists, REPLACE it with the new version`,
    ``,
    `The executionPrompt is the most important field. It tells another AI what to code.`,
    `If the risk says "no auth", the executionPrompt must describe implementing auth.`,
    `If the risk says "slow queries", the executionPrompt must describe query optimization.`,
    ``,
    `DO NOT just update the risks array. Output the COMPLETE updated blueprint JSON.`,
  ].join("\n");

  const messages: Message[] = [{ role: "user" as const, content: userContent }];

  // Select model and call AI with retries
  let currentDecision: RouterDecision;
  try {
    currentDecision = router.select("blueprint", preferences);
  } catch {
    log.warn({ planId }, "refine_router_no_provider");
    return null;
  }

  const MAX_ATTEMPTS = 3;
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
      const json = extractJson(raw);
      if (!json) {
        log.warn({ preview: raw.slice(0, 200) }, "refine_parse_failed");
        if (currentDecision.fallbackChain.length === 0) break;
        currentDecision = {
          ...currentDecision,
          selection: currentDecision.fallbackChain[0]!,
          fallbackChain: currentDecision.fallbackChain.slice(1),
          usedFallback: true,
        };
        continue;
      }

      // Extract changeSummary from AI output if present (before Zod validation strips it)
      const changeSummary = (json.changeSummary as string) ?? null;

      // ── Layer 2: Post-processing validation + Layer 3: Deterministic repair ──
      // Determine which phases the selected risks map to
      const relevantPhases = new Set<string>();
      for (const riskId of riskIds) {
        const r = existingRisks.find((er) => er.id === riskId);
        if (r) {
          riskToPhaseKeywords((r.description as string) ?? "").forEach((p) => relevantPhases.add(p));
        }
      }

      // Check if the AI actually updated those phases
      const newPhasesArr = (json.phases ?? []) as Record<string, unknown>[];
      const existingPhasesArr = (existingRaw.phases ?? []) as Record<string, unknown>[];
      let phasesUpdated = false;
      for (const pt of relevantPhases) {
        const oldP = existingPhasesArr.find((p) => p.phaseType === pt);
        const newP = newPhasesArr.find((p) => p.phaseType === pt);
        if (oldP && newP && ((oldP.summary as string) !== (newP.summary as string) || (oldP.narrative as string) !== (newP.narrative as string))) {
          phasesUpdated = true;
          break;
        }
      }

      if (!phasesUpdated && relevantPhases.size > 0) {
        log.warn({ relevantPhases: [...relevantPhases], riskIds }, "refine_phases_not_updated_applying_repair");
        repairPhaseContent(json, riskIds, existingRisks);
      }

      // Clean phases: ensure array order matches PHASE_ORDER
      let phases = json.phases;
      if (Array.isArray(phases)) {
        const phaseMap = new Map<string, Record<string, unknown>>();
        for (const p of phases as Record<string, unknown>[]) {
          const pt = p.phaseType as string;
          if (pt) phaseMap.set(pt, p);
        }
        phases = PHASE_ORDER.map((pt) => phaseMap.get(pt) ?? {
          phaseType: pt,
          phaseName: pt,
          summary: `Planning for ${pt}`,
          narrative: `Phase ${pt} analysis.`,
          status: "sufficient",
          confidence: 0.5,
          keyDecisions: [],
        });
      }

      const now = new Date().toISOString();
      const genMetadata = {
        model: result.model,
        provider: sel.provider,
        generationId: crypto.randomUUID(),
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        estimatedCost: 0,
        fallbackUsed: false,
      };

      // Validate blueprint
      const blueprintInput = {
        planId,
        planVersion,
        projectId,
        sessionId,
        createdAt: now,
        schemaVersion: "orchestra-generated-v1",
        artifactType: "blueprint",
        phases,
        assumptions: json.assumptions ?? [],
        constraints: json.constraints ?? [],
        risks: json.risks ?? [],
        overallConfidence: json.overallConfidence ?? 0.5,
        overallSummary: json.overallSummary ?? "",
        generationMetadata: genMetadata,
      };

      const bpResult = BlueprintOutputSchema.safeParse(blueprintInput);
      if (!bpResult.success) {
        log.warn({ issues: bpResult.error.issues }, "refine_blueprint_zod_error");
        if (currentDecision.fallbackChain.length === 0) break;
        currentDecision = {
          ...currentDecision,
          selection: currentDecision.fallbackChain[0]!,
          fallbackChain: currentDecision.fallbackChain.slice(1),
          usedFallback: true,
        };
        continue;
      }

      // Validate roadmap
      const rawRoadmap = (json.roadmapPhases ?? json.phases ?? []) as Record<string, unknown>[];
      const roadmapPhases = Array.isArray(rawRoadmap)
        ? rawRoadmap.map((p, i) => ({
            phaseType: p.phaseType ?? PHASE_ORDER[i] ?? "ideation",
            phaseName: p.phaseName ?? "",
            order: p.order ?? i,
            effort: p.effort ?? "medium",
            prerequisites: Array.isArray(p.prerequisites) ? p.prerequisites : [],
            estimatedDuration: p.estimatedDuration,
            rationale: p.rationale,
          }))
        : [];

      const rmResult = RoadmapOutputSchema.safeParse({
        planId,
        planVersion,
        projectId,
        sessionId,
        createdAt: now,
        schemaVersion: "orchestra-generated-v1",
        artifactType: "roadmap",
        phases: roadmapPhases,
        totalEffort: json.totalEffort ?? "medium",
        recommendedApproach: json.recommendedApproach,
        generationMetadata: genMetadata,
      });

      if (!rmResult.success) {
        log.warn({ issues: rmResult.error.issues }, "refine_roadmap_zod_error");
        continue;
      }

      // Compute change summary from diff
      const oldBp = BlueprintOutputSchema.parse({
        ...(existingRaw as Record<string, unknown>),
        planId, planVersion, projectId, sessionId, createdAt: now,
        schemaVersion: "orchestra-generated-v1", artifactType: "blueprint",
        generationMetadata: genMetadata,
      });
      const summary = changeSummary ?? computeChangeSummary(oldBp, bpResult.data, riskIds, relevantPhases);

      log.info({ model: result.model, provider: sel.provider }, "refine_success");
      return {
        blueprint: bpResult.data,
        roadmap: rmResult.data,
        changeSummary: summary,
        provider: sel.provider,
        model: result.model,
      };
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err, attempt, provider: sel.provider }, "refine_provider_error");
      if (currentDecision.fallbackChain.length === 0) break;
      currentDecision = {
        ...currentDecision,
        selection: currentDecision.fallbackChain[0]!,
        fallbackChain: currentDecision.fallbackChain.slice(1),
        usedFallback: true,
      };
    }
  }

  log.warn({ planId }, "refine_all_attempts_failed");
  return null;
}
