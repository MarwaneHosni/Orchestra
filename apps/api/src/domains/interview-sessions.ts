import type { FastifyInstance } from "fastify";
import { OrchestrationService } from "../lib/orchestration/orchestration.service.js";
import { getStore } from "../lib/orchestration/store.js";
import { SubmitAnswerSchema, TransitionSchema } from "../lib/orchestration/orchestration.service.js";
import { NotFoundError, ValidationError, RateLimitedError, OverBudgetError } from "../lib/errors.js";
import { GuardrailService } from "../lib/budget/guardrail.js";
import { createInMemoryBudgetStore } from "../lib/budget/budget.js";
import { getTracer } from "../lib/metrics/index.js";

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
      const sessionId = (request.params as { id: string }).id;
      const session = getStore().getSession(sessionId);
      if (!session) throw new NotFoundError("Session", sessionId);

      const tracer = getTracer();
      const rootSpan = tracer.startSpan("generation.blueprint");
      rootSpan.tags["projectId"] = session.projectId;
      rootSpan.tags["sessionId"] = sessionId;

      try {
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
          const output = orch.generateBlueprint(sessionId);
          guardrail.budget.recordOutcome(session.projectId, estimatedCost, estimatedTokens, "completed");
          guardrail.getCircuitBreaker("provider")?.recordSuccess();
          guardrail.abuseDetector.clear(session.projectId);
          tracer.endSpan(rootSpan, "ok");
          return output;
        } catch (err) {
          guardrail.budget.recordOutcome(session.projectId, 0, 0, "failed");
          guardrail
            .ensureCircuitBreaker("provider", { failureThreshold: 5, openTimeoutMs: 30_000 })
            .recordFailure();
          guardrail.abuseDetector.recordFailure(session.projectId);
          tracer.endSpan(rootSpan, "error", err instanceof Error ? err.message : String(err));
          throw err;
        }
      } catch (err) {
        tracer.endSpan(rootSpan, "error", err instanceof Error ? err.message : String(err));
        throw err;
      }
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
        const output = orch.generateBlueprint(sessionId);
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
