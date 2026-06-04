import type { AIProvider, GenerationInput, Message } from "../provider/types.js";
import { OpenAIProvider } from "../provider/openai.js";
import { AnthropicProvider } from "../provider/anthropic.js";
import { OpenRouterProvider } from "../provider/openrouter.js";
import { OpencodeGoProvider } from "../provider/opencode-go.js";
import type { RouterService } from "../router/router.js";
import type { RouterDecision, ModelSelection, UserPreferences } from "../router/types.js";
import type { TaskNode, DependencyEdge, DepType } from "../task-graph/types.js";
import { getCredentialStore, decryptKey } from "../credentials/store.js";
import { getGraphStore } from "../shared-stores.js";
import { computeStatuses } from "../task-graph/generator.js";
import { generateWithRetry } from "../generation/ai-generator.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("phase-resolver");

interface ResolveResult {
  tasks: TaskNode[];
  dependencies: DependencyEdge[];
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

function buildResolvePrompt(
  phaseName: string,
  phaseType: string,
  phaseSummary: string,
  phaseNarrative: string,
  keyDecisions: string[],
  blueprintConstraints: string[],
  inputText: string,
  existingTaskCount: number,
): { systemPrompt: string; messages: Message[] } {
  const systemPrompt = `You are an expert project planner. Given a specific phase of an existing project plan and additional user-provided context, generate a detailed, realistic task breakdown for JUST that phase.

Output ONLY valid JSON with no extra text, no markdown fences.

The response object must contain:
- "tasks": ARRAY of 1-5 task objects. Each task must have:
    "title": string (actionable, based on the phase + user input)
    "type": "code" | "config" | "test" | "docs" | "review" | "deploy" | "other"
    "priority": "low" | "medium" | "high" | "critical"
    "acceptanceCriteria": string[] (2-4 concrete checks)
    "estimatedPromptRounds": number (1-3)

Generate ${existingTaskCount}-5 tasks (at least ${existingTaskCount}). Make them specific to the user's new input.`;

  const messages: Message[] = [{
    role: "user" as const,
    content: [
      `=== EXISTING PLAN CONTEXT ===`,
      `Phase: ${phaseName} (${phaseType})`,
      `Summary: ${phaseSummary}`,
      `Narrative: ${phaseNarrative}`,
      `Key decisions: ${keyDecisions.length > 0 ? keyDecisions.join("; ") : "none recorded"}`,
      ``,
      `=== PROJECT CONSTRAINTS ===`,
      ...(blueprintConstraints.length > 0 ? blueprintConstraints.map((c) => `  - ${c}`) : ["  (none)"]),
      ``,
      `=== USER'S ADDITIONAL INPUT ===`,
      inputText,
      ``,
      `Generate a task breakdown for the "${phaseName}" phase incorporating this new information.`,
    ].join("\n"),
  }];

  return { systemPrompt, messages };
}

async function callAIDirectly(
  router: RouterService,
  systemPrompt: string,
  messages: Message[],
  preferences?: UserPreferences,
): Promise<string | null> {
  let currentDecision: RouterDecision;
  try {
    currentDecision = router.select("blueprint", preferences ?? {});
  } catch {
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

    try {
      const input: GenerationInput = {
        model: sel.model,
        systemPrompt,
        messages,
        temperature: 0.3,
      };
      const result = await generateWithRetry(() => createProvider(sel), input);
      return result.content.trim();
    } catch {
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

function extractTaskJson(content: string): Record<string, unknown> | null {
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
      if (obj && typeof obj === "object" && (obj as Record<string, unknown>).tasks) {
        const size = candidate.length;
        if (size > bestSize) { best = obj; bestSize = size; }
      }
    } catch { /* skip */ }
    searchFrom = openIdx + 1;
  }
  return best as Record<string, unknown> | null;
}

export async function resolvePendingPhase(
  planId: string,
  planVersion: number,
  phaseType: string,
  phaseName: string,
  phaseSummary: string,
  phaseNarrative: string,
  keyDecisions: string[],
  blueprintConstraints: string[],
  inputText: string,
  router: RouterService,
  preferences?: UserPreferences,
): Promise<ResolveResult | null> {
  // Determine existing task count for this phase to set AI target
  const existingGraph = getGraphStore().getGraph(planId, planVersion);
  const existingPhaseTasks = existingGraph?.tasks.filter((t) => t.phaseType === phaseType) ?? [];
  const existingCount = existingPhaseTasks.filter((t) => t.type !== "pending_input").length;

  const { systemPrompt, messages } = buildResolvePrompt(
    phaseName, phaseType, phaseSummary, phaseNarrative,
    keyDecisions, blueprintConstraints, inputText,
    Math.max(1, existingCount),
  );

  const raw = await callAIDirectly(router, systemPrompt, messages, preferences);
  if (!raw) {
    log.warn({ phaseType, planId }, "resolve_ai_call_failed");
    return null;
  }

  const json = extractTaskJson(raw);
  if (!json || !Array.isArray(json.tasks)) {
    log.warn({ phaseType, preview: raw.slice(0, 200) }, "resolve_parse_failed");
    return null;
  }

  const rawTasks = json.tasks as Record<string, unknown>[];
  const validTypes = ["code", "config", "test", "docs", "review", "deploy", "other"];
  const validPrios = ["low", "medium", "high", "critical"];
  let globalOrder = 0;

  // Calculate starting order: after the last task before this phase
  if (existingGraph) {
    const phaseIdx = existingGraph.tasks.findIndex((t) => t.phaseType === phaseType);
    if (phaseIdx >= 0) {
      const before = existingGraph.tasks
        .filter((t) => t.order < existingGraph.tasks[phaseIdx]!.order)
        .sort((a, b) => b.order - a.order);
      globalOrder = before.length > 0 ? before[0]!.order + 1 : 0;
    }
  }

  const tasks: TaskNode[] = [];
  for (const t of rawTasks.slice(0, 5)) {
    const title = typeof t.title === "string" ? t.title.slice(0, 200) : `Task for ${phaseType}`;
    const type = typeof t.type === "string" && validTypes.includes(t.type) ? t.type : "code";
    const priority = typeof t.priority === "string" && validPrios.includes(t.priority) ? t.priority : "medium";
    const rounds = typeof t.estimatedPromptRounds === "number" && t.estimatedPromptRounds >= 1 && t.estimatedPromptRounds <= 3
      ? Math.round(t.estimatedPromptRounds) : 2;
    const criteria: string[] = Array.isArray(t.acceptanceCriteria)
      ? t.acceptanceCriteria.filter((c): c is string => typeof c === "string" && c.length > 0).slice(0, 8)
      : [`Complete ${title}`];

    tasks.push({
      id: crypto.randomUUID(),
      planId,
      phaseType,
      title,
      type: type as TaskNode["type"],
      priority: priority as TaskNode["priority"],
      status: "pending",
      order: globalOrder++,
      dependencies: [],
      acceptanceCriteria: criteria,
      estimatedPromptRounds: rounds,
    });
  }

  if (tasks.length === 0) return null;

  // Compute dependencies within the new tasks (sequential)
  const newDeps: DependencyEdge[] = [];
  for (let i = 1; i < tasks.length; i++) {
    newDeps.push({ taskId: tasks[i]!.id, dependsOnTaskId: tasks[i - 1]!.id, dependencyType: "blocks" as DepType });
  }

  // Compute cross-phase dependencies: link to previous and next phases
  if (existingGraph) {
    // Link from last task of previous phase to first new task
    const prevPhaseTasks = existingGraph.tasks
      .filter((t) => t.order < globalOrder - tasks.length)
      .sort((a, b) => b.order - a.order);
    if (prevPhaseTasks.length > 0) {
      newDeps.push({ taskId: tasks[0]!.id, dependsOnTaskId: prevPhaseTasks[0]!.id, dependencyType: "blocks" as DepType });
    }

    // Link from last new task to first task of next phase
    const nextPhaseTasks = existingGraph.tasks
      .filter((t) => t.order >= globalOrder && t.phaseType !== phaseType)
      .sort((a, b) => a.order - b.order);
    if (nextPhaseTasks.length > 0) {
      newDeps.push({ taskId: nextPhaseTasks[0]!.id, dependsOnTaskId: tasks[tasks.length - 1]!.id, dependencyType: "blocks" as DepType });
    }
  }

  // Compute initial statuses for new tasks
  const allTaskIds = new Set(tasks.map((t) => t.id));
  const allDeps: DependencyEdge[] = [...newDeps, ...((existingGraph?.dependencies ?? []).filter(
    (d): d is DependencyEdge => allTaskIds.has(d.taskId) || allTaskIds.has(d.dependsOnTaskId),
  ))];
  computeStatuses(tasks, allDeps);

  return { tasks, dependencies: newDeps };
}
