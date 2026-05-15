import type { FastifyInstance } from "fastify";
import { OrchestrationService } from "../lib/orchestration/orchestration.service.js";
import { getStore } from "../lib/orchestration/store.js";
import { SubmitAnswerSchema, TransitionSchema } from "../lib/orchestration/orchestration.service.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

export async function registerInterviewSessionRoutes(app: FastifyInstance) {
  const orch = new OrchestrationService(getStore());

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

  app.post("/api/v1/interviews/:id/start", async (request) => {
    const session = orch.startSession((request.params as { id: string }).id);
    return { sessionId: session.id, status: session.status };
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

  app.post("/api/v1/interviews/:id/transition", async (request) => {
    const parsed = TransitionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid transition data");
    }
    const session = orch.transitionSession((request.params as { id: string }).id, parsed.data.toStatus);
    return { sessionId: session.id, status: session.status };
  });
}
