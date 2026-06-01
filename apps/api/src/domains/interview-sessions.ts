import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { OrchestrationService } from "../lib/orchestration/orchestration.service.js";
import { getStore } from "../lib/orchestration/store.js";
import { SubmitAnswerSchema, TransitionSchema } from "../lib/orchestration/orchestration.service.js";
import { NotFoundError, ValidationError, RateLimitedError, OverBudgetError } from "../lib/errors.js";
import { GuardrailService } from "../lib/budget/guardrail.js";
import { createInMemoryBudgetStore } from "../lib/budget/budget.js";
import { generateWithAI } from "../lib/generation/orchestrator.js";
import { estimatePromptTokens, estimateCost } from "../lib/accounting/index.js";
import { getDb } from "../db/sqlite/index.js";
import * as schema from "../db/sqlite/schema/index.js";

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

    const body = (request.body ?? {}) as { mode?: string };
    const mode = body.mode === "advanced" ? "advanced" : "quick";
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    getStore().insertSession({
      id: sessionId,
      projectId: project.id,
      status: "draft",
      currentPhaseIndex: 0,
      currentQuestionIndex: 0,
      mode,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    reply.status(201);
    return { sessionId, status: "draft", mode };
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

  app.get("/api/v1/interviews/:id/blueprint", async (request) => {
    const sessionId = (request.params as { id: string }).id;
    const session = getStore().getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);

    const plans = getStore().getPlansByProject(session.projectId);
    const latestPlan = plans
      .filter((p) => p.status === "complete" && !p.staleAt)
      .sort((a, b) => b.version - a.version)[0];
    if (!latestPlan) throw new NotFoundError("Blueprint", sessionId);

    const blueprints = getStore().getBlueprintsByProject(session.projectId);
    const bp = blueprints.find((b) => b.planId === latestPlan.id && b.status === "complete");
    if (!bp) throw new NotFoundError("Blueprint", sessionId);

    const parsed = JSON.parse(bp.content);
    return {
      ...parsed,
      projectId: session.projectId,
      sessionId,
      planVersion: latestPlan.version,
    };
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
      schema: { body: { type: "object", properties: { workflowId: { type: "string" } }, additionalProperties: false } },
    },
    async (request) => {
      const sessionId = (request.params as { id: string }).id;
      const body = (request.body ?? {}) as { workflowId?: string };
      const session = getStore().getSession(sessionId);
      if (!session) throw new NotFoundError("Session", sessionId);

      const answers = getStore().getLatestAnswersBySession(sessionId);
      app.log.info({ sessionId, answerCount: answers.length, sessionStatus: session.status, projectId: session.projectId }, "generate_handler_start");

      // Guardrail check: rate limit + budget + circuit breaker + abuse detection
      const promptTokenEstimate = answers.length > 0
        ? estimatePromptTokens(answers.map((a) => ({ role: "user", content: a.value })))
        : 1000;
      const costEstimate = estimateCost({
        provider: "opencode-go",
        model: "deepseek-v4-flash",
        promptTokenEstimate,
        completionTokenEstimate: 2000,
      });
      const guardResult = guardrail.checkGeneration(
        session.projectId,
        "system",
        costEstimate.estimatedCost,
        promptTokenEstimate,
      );
      if (!guardResult.allowed) {
        app.log.warn({ sessionId, blockedBy: guardResult.blockedBy, reason: guardResult.reason }, "generate_handler_guardrail_blocked");
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
      app.log.info({ sessionId, projectId: session.projectId }, "generate_handler_guardrail_passed");

      // Resolve planId before try so catch block can reference it
      const project = getStore().getProject(session.projectId);
      if (!project) throw new NotFoundError("Project", session.projectId);
      const existingPlans = getStore().getPlansByProject(project.id);
      const planVersion = existingPlans.length + 1;
      const planId = `plan-${sessionId}`;

      try {
        // Ensure session is in the right state
        if (session.status !== "ready_for_generation" && session.status !== "completed") {
          throw new Error(
            `Session must be ready_for_generation before generating a blueprint (current: ${session.status})`,
          );
        }

        getStore().insertPlan({
          id: planId,
          projectId: project.id,
          version: planVersion,
          status: "generating",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        app.log.info({ planId, planVersion, sessionId }, "generate_handler_plan_created");

        const generateStart = Date.now();
        const aiResult = await generateWithAI(
          project.id,
          project.name,
          project.description,
          sessionId,
          answers,
          planId,
          planVersion,
          body.workflowId,
        );
        const generateElapsed = Date.now() - generateStart;
        app.log.info({ mode: aiResult.mode, provider: aiResult.provider, model: aiResult.model, elapsedMs: generateElapsed }, "generate_handler_ai_result");

        let output: object;

        if (aiResult.mode === "ai_success") {
          app.log.info({ sessionId, planId, provider: aiResult.provider, model: aiResult.model, elapsedMs: generateElapsed }, "generate_handler_ai_success");
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
          // Plan record creation — update status from "generating" to "complete"
          const now = new Date().toISOString();
          getDb()
            .update(schema.plans)
            .set({ status: "complete", updatedAt: now })
            .where(eq(schema.plans.id, planId))
            .run();
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
          app.log.info({ sessionId, planId, planVersion, phaseCount: rawPhases.length }, "generate_handler_blueprint_saved");
          orch.transitionSession(sessionId, "completed");
          app.log.info({ sessionId, newStatus: "completed" }, "generate_handler_session_transitioned");
          output = aiResult.output;
          app.log.info({ model: aiResult.model, provider: aiResult.provider }, "AI-generated blueprint");
        } else {
          // Fall back to deterministic generation (handles plan/blueprint creation internally)
          app.log.info({ mode: aiResult.mode }, "AI generation unavailable — using deterministic fallback");
          const fallbackStart = Date.now();
          output = orch.generateBlueprint(sessionId);
          app.log.info({ elapsedMs: Date.now() - fallbackStart }, "generate_handler_deterministic_fallback_done");
        }

        const actualTokens = aiResult.usage?.totalTokens ?? promptTokenEstimate;
        guardrail.budget.recordOutcome(session.projectId, costEstimate.estimatedCost, actualTokens, "completed");
        guardrail.getCircuitBreaker("provider")?.recordSuccess();
        guardrail.abuseDetector.clear(session.projectId);
        app.log.info({ sessionId, totalElapsedMs: Date.now() - generateStart }, "generate_handler_success");
        return output;
      } catch (err) {
        app.log.error({ err: err instanceof Error ? err.message : err, sessionId, planId }, "generate_handler_caught_error");
        // Mark plan as failed on error
        const failNow = new Date().toISOString();
        getDb()
          .update(schema.plans)
          .set({ status: "failed", updatedAt: failNow })
          .where(eq(schema.plans.id, planId))
          .run();
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
