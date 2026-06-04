import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { paginatedResponse, paginationSchema } from "../schemas/index.js";
import { OrchestrationService } from "../lib/orchestration/orchestration.service.js";
import { getStore } from "../lib/orchestration/store.js";
import { CreateProjectSchema } from "../lib/orchestration/orchestration.service.js";
import { queueSyncDb } from "../db/sqlite/index.js";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectListSchema = paginationSchema;

export async function registerProjectRoutes(app: FastifyInstance) {
  const orch = new OrchestrationService(getStore());

  app.get(
    "/api/v1/projects",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { page: { type: "number" }, pageSize: { type: "number" } },
        },
        response: {
          200: { type: "object", properties: { data: { type: "array" }, meta: { type: "object" } } },
        },
      },
    },
    async (request) => {
      const query = ProjectListSchema.parse(request.query);
      const all = getStore().getAllProjects();
      const total = all.length;
      const offset = (query.page - 1) * query.pageSize;
      const page = all.slice(offset, offset + query.pageSize);
      return paginatedResponse(page, total, query.page, query.pageSize);
    },
  );

  app.get("/api/v1/projects/:id", async (request) => {
    const { id } = request.params as { id: string };
    const project = getStore().getProject(id);
    if (!project) throw new NotFoundError("Project", id);
    return project;
  });

  app.post("/api/v1/projects", async (request, reply) => {
    const parsed = CreateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid project data");
    }
    const result = orch.createProject(parsed.data as { ideaText: string; projectName?: string });
    await queueSyncDb();
    reply.status(201);
    return { projectId: result.projectId, sessionId: result.sessionId };
  });

  app.delete("/api/v1/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = getStore().getProject(id);
    if (!project) throw new NotFoundError("Project", id);
    getStore().deleteProject(id);
    await queueSyncDb();
    reply.status(204);
    return;
  });
}
