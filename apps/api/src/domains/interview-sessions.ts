import type { FastifyInstance } from "fastify";
import { OrchestrationService } from "../lib/orchestration/orchestration.service.js";
import { getStore } from "../lib/orchestration/store.js";
import { SubmitAnswerSchema, TransitionSchema } from "../lib/orchestration/orchestration.service.js";
import { NotFoundError, ValidationError, RateLimitedError, OverBudgetError } from "../lib/errors.js";
import { GuardrailService } from "../lib/budget/guardrail.js";
import { createInMemoryBudgetStore } from "../lib/budget/budget.js";
import { generateWithAI } from "../lib/generation/orchestrator.js";

export async function registerInterviewSessionRoutes(app: FastifyInstance) {
  const orch = new OrchestrationService(getStore());
  const guardrail = new GuardrailService(createInMemoryBudgetStore());

  app.post("/api/v1/projects/:projectId/interviews", async (request, reply) => {
    const projectId = (request.params as { projectId: string }).projectId;
    const project = getStore().getProject(projectId);
    if (!project) throw new NotFoundError("Project", projectId);

    const sessions = getStore().getSessionsByProject(project.id);
    const active = sessions.find((s) => s.status !== "completed");
    if (active) {
      return { sessionId: active.id, status: active.status };
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    getStore().insertSession({
      id: sessionId,
      projectId: project.id,
      status: "draft",
      currentPhaseIndex: 0,
      currentQuestionIndex: 0,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    reply.status(201);
    return { sessionId, status: "draft" };
  });

  app.post(
    "/api/v1/interviews/:id/start",
    {
      schema: { body: { type: "object", properties: {}, additionalProperties: false } },
    },
    async (request) => {
      const session = orch.startSession((request.params as { id: string }).id);
      return { sessionId: session.id, status: session.status };
    },
  );

  app.get("/api/v1/interviews/:id/resume", async (request) => {
    const result = orch.resumeSession((request.params as { id: string }).id);
    return result;
  });

  app.get("/api/v1/interviews/:id/answers", async (request) => {
    const answers = orch.getSessionAnswers((request.params as { id: string }).id);
    return { data: answers };
  });

  app.get("/api/v1/interviews/:id/next", async (request) => {
    const result = orch.getNextQuestion((request.params as { id: string }).id);
    return result;
  });

  app.post("/api/v1/interviews/:id/answers", async (request) => {
    const parsed = SubmitAnswerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid answer data");
    }
    const { questionId, value, confidence } = parsed.data;
    const result = orch.submitAnswer((request.params as { id: string }).id, questionId, value, confidence);
    return result;
  });

  app.post(
    "/api/v1/interviews/:id/generate",
    {
      schema: { body: { type: "object", properties: {}, additionalProperties: false } },
    },
    async (request) => {
      const sessionId = (request.params as { id: string }).id;
      const session = getStore().getSession(sessionId);
      if (!session) throw new NotFoundError("Session", sessionId);

      // Guardrail check: rate limit + budget + circuit breaker + abuse detection
      const estimatedCost = 0.001;
      const estimatedTokens = 500;
      const guardResult = guardrail.checkGeneration(
        session.projectId,
        "system",
        estimatedCost,
        estimatedTokens,
      );
      if (!guardResult.allowed) {
        if (guardResult.blockedBy === "rate_limit") {
          throw new RateLimitedError(
            guardResult.reason ?? "Rate limit exceeded",
            guardResult.retryAfterMs ?? 60_000,
            "generation",
          );
        }
        if (guardResult.blockedBy === "budget") {
          throw new OverBudgetError(guardResult.reason ?? "Budget exceeded", session.projectId);
        }
        throw new RateLimitedError(guardResult.reason ?? "Request blocked", 30_000, "generation");
      }

      try {
        // Ensure session is in the right state
        if (session.status !== "ready_for_generation" && session.status !== "completed") {
          throw new Error(
            `Session must be ready_for_generation before generating a blueprint (current: ${session.status})`,
          );
        }

        // Try AI generation with stored credentials
        const project = getStore().getProject(session.projectId);
        if (!project) throw new NotFoundError("Project", session.projectId);

        const existingPlans = getStore().getPlansByProject(project.id);
        const planVersion = existingPlans.length + 1;
        const planId = sessionId;

        const answers = getStore().getLatestAnswersBySession(sessionId);
        const aiResult = await generateWithAI(
          project.id,
          project.name,
          project.description,
          sessionId,
          answers,
          planId,
          planVersion,
        );

        let output: object;

        if (aiResult.mode === "ai_success") {
          // AI succeeded — use the AI-generated blueprint
          // Normalize AI output to match the expected frontend shape
          const aiOutput = aiResult.output as Record<string, unknown>;
          const rawPhases = (aiOutput.phases ?? []) as Record<string, unknown>[];
          output = {
            projectId: project.id,
            sessionId,
            planVersion,
            generatedAt: new Date().toISOString(),
            projectName: project.name,
            projectDescription: project.description,
            ...aiOutput,
            phases: rawPhases.map((p) => ({
              ...p,
              answers: [],
              ambiguityFlags: [],
            })),
            ambiguityFlags: [],
            assumptions: ((aiOutput.assumptions ?? []) as Record<string, unknown>[]).map((a) => ({
              id: a.id ?? "",
              description: a.description ?? "",
              source: a.source ?? "",
              provenance: a.provenance ?? "",
            })),
            constraints: ((aiOutput.constraints ?? []) as Record<string, unknown>[]).map((c) => ({
              id: c.id ?? "",
              description: c.description ?? "",
              source: c.source ?? "",
              provenance: c.provenance ?? "",
            })),
            risks: ((aiOutput.risks ?? []) as Record<string, unknown>[]).map((r) => ({
              id: r.id ?? "",
              description: r.description ?? "",
              source: r.source ?? "",
              provenance: r.provenance ?? "",
            })),
          };
          // Plan record creation
          const now = new Date().toISOString();
          getStore().insertPlan({
            id: planId,
            projectId: project.id,
            version: planVersion,
            status: "complete",
            staleAt: null,
            createdAt: now,
            updatedAt: now,
          });
          getStore().insertBlueprint({
            id: crypto.randomUUID(),
            planId,
            projectId: project.id,
            content: JSON.stringify(aiResult.output),
            format: "json",
            version: planVersion,
            status: "complete",
            staleAt: null,
            createdAt: now,
            updatedAt: now,
          });
          orch.transitionSession(sessionId, "completed");
          output = aiResult.output;
          app.log.info({ model: aiResult.model, provider: aiResult.provider }, "AI-generated blueprint");
        } else {
          // Fall back to deterministic generation (handles plan/blueprint creation internally)
          app.log.info({ mode: aiResult.mode }, "AI generation unavailable — using deterministic fallback");
          output = orch.generateBlueprint(sessionId);
        }

        guardrail.budget.recordOutcome(session.projectId, estimatedCost, estimatedTokens, "completed");
        guardrail.getCircuitBreaker("provider")?.recordSuccess();
        guardrail.abuseDetector.clear(session.projectId);
        return output;
      } catch (err) {
        guardrail.budget.recordOutcome(session.projectId, 0, 0, "failed");
        guardrail
          .ensureCircuitBreaker("provider", { failureThreshold: 5, openTimeoutMs: 30_000 })
          .recordFailure();
        guardrail.abuseDetector.recordFailure(session.projectId);
        throw err;
      }
    },
  );

  app.post("/api/v1/interviews/:id/transition", async (request) => {
    const parsed = TransitionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid transition data");
    }
    const session = orch.transitionSession((request.params as { id: string }).id, parsed.data.toStatus);
    return { sessionId: session.id, status: session.status };
  });
}
