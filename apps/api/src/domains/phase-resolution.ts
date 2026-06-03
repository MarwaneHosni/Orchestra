import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getStore } from "../lib/orchestration/store.js";
import { getGraphStore, getPromptStore } from "../lib/shared-stores.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { RouterService } from "../lib/router/router.js";
import { getCredentialStore } from "../lib/credentials/store.js";
import { resolvePendingPhase } from "../lib/resolution/phase-resolver.js";
import { assemblePrompt } from "../lib/prompt/assembler.js";
import { createModuleLogger } from "../lib/logging/logger.js";

const log = createModuleLogger("phase-resolution");

const ResolveSchema = z.object({
  inputText: z.string().min(10, "Input must be at least 10 characters"),
});

export async function registerPhaseResolutionRoutes(app: FastifyInstance) {
  app.post("/api/v1/plans/:planId/phases/:phaseType/resolve-pending", async (request) => {
    const { planId, phaseType } = request.params as { planId: string; phaseType: string };
    const body = ResolveSchema.safeParse(request.body);
    if (!body.success) {
      throw new ValidationError(body.error.issues.map((i) => i.message).join("; "));
    }
    const { inputText } = body.data;

    // planId follows pattern plan-{sessionId}
    const sessionId = planId.startsWith("plan-") ? planId.slice(5) : planId;
    const session = getStore().getSession(sessionId);
    if (!session) throw new NotFoundError("Session", sessionId);

    const project = getStore().getProject(session.projectId);
    if (!project) throw new NotFoundError("Project", session.projectId);

    const blueprints = getStore().getBlueprintsByProject(session.projectId);
    const bp = blueprints.find((b) => b.planId === planId && b.status === "complete");
    if (!bp) throw new NotFoundError("Blueprint", planId);

    const blueprint = JSON.parse(bp.content) as Record<string, unknown>;
    const phases = (blueprint.phases ?? []) as Record<string, unknown>[];
    const phase = phases.find((p) => p.phaseType === phaseType);
    if (!phase) throw new NotFoundError("Phase", phaseType);

    const graph = getGraphStore().getGraph(planId, 1);
    if (!graph) throw new NotFoundError("TaskGraph", planId);

    // Build router with available credentials
    const allCreds = getCredentialStore().list();
    const router = new RouterService((provider: string) => {
      const cred = allCreds.find((c) => c.provider === provider);
      return {
        provider,
        available: cred?.status === "valid" || cred?.status === "unverified",
        validatedAt: cred?.lastVerifiedAt ?? null,
      };
    });

    const userCred = allCreds.find((c) => c.status === "valid" || c.status === "unverified");
    const preferences = userCred?.defaultModel
      ? { preferredProvider: userCred.provider, preferredModel: userCred.defaultModel }
      : undefined;

    const phaseName = (phase.phaseName as string) ?? phaseType;
    const phaseSummary = (phase.summary as string) ?? "";
    const phaseNarrative = (phase.narrative as string) ?? "";
    const keyDecisions = (phase.keyDecisions as string[]) ?? [];
    const constraints = ((blueprint.constraints ?? []) as Record<string, unknown>[]).map(
      (c) => (c.description as string) ?? "",
    );

    const result = await resolvePendingPhase(
      planId, graph.planVersion, phaseType,
      phaseName, phaseSummary, phaseNarrative,
      keyDecisions, constraints, inputText,
      router, preferences,
    );

    if (!result) {
      throw new Error(
        "Failed to generate new tasks for this phase. The AI was unable to produce a valid task breakdown.",
      );
    }

    const oldTaskIds = graph.tasks
      .filter((t) => t.phaseType === phaseType)
      .map((t) => t.id);

    const updatedGraph = getGraphStore().replacePhaseTasks(
      planId, graph.planVersion, phaseType,
      oldTaskIds, result.tasks, result.dependencies,
    );

    if (!updatedGraph) {
      throw new Error("Failed to store updated tasks.");
    }

    // Generate execution prompts for new tasks
    const toDesc = (arr: unknown[] | undefined): { description: string }[] =>
      (arr ?? []).map((a) => {
        const o = a as Record<string, unknown>;
        return { description: (o.description as string) ?? "" };
      });

    for (const task of result.tasks) {
      const ctx = {
        task,
        planName: project.name,
        allTasks: updatedGraph.tasks,
        predecessorOutputs: [] as string[],
        phaseSummary,
        aiPhaseSummary: phaseSummary,
        aiPhaseNarrative: phaseNarrative,
        aiPhaseStatus: "sufficient",
        aiKeyDecisions: keyDecisions,
        aiAssumptions: toDesc(blueprint.assumptions as unknown[]),
        aiConstraints: toDesc(blueprint.constraints as unknown[]),
        aiRisks: toDesc(blueprint.risks as unknown[]),
        aiOverallSummary: (blueprint.overallSummary as string) ?? "",
      };
      assemblePrompt(ctx as any, getPromptStore(), graph.planVersion);
    }

    log.info({ planId, phaseType, taskCount: result.tasks.length }, "phase_resolved");
    return {
      planId,
      phaseType,
      tasks: updatedGraph.tasks.filter((t) => t.phaseType === phaseType),
      status: "resolved",
    };
  });
}
