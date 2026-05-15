import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { paginatedResponse, paginationSchema } from "../schemas/index.js";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(5000).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const ProjectListSchema = paginationSchema;

const projects: Project[] = [];

export async function registerProjectRoutes(app: FastifyInstance) {
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
      return paginatedResponse(projects, projects.length, query.page, query.pageSize);
    },
  );

  app.get("/api/v1/projects/:id", async (request) => {
    const { id } = request.params as { id: string };
    const project = projects.find((p) => p.id === id);
    if (!project) throw new NotFoundError("Project", id);
    return project;
  });

  app.post("/api/v1/projects", async (request, reply) => {
    const parsed = CreateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid project data");
    }
    const project: Project = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.push(project);
    reply.status(201);
    return project;
  });
}
