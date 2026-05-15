import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateTasks, createInMemoryGraphStore } from "../lib/task-graph/generator.js";
import { assemblePrompt, createInMemoryPromptStore } from "../lib/prompt/index.js";
import { NotFoundError } from "../lib/errors.js";
import type { PhaseInput } from "../lib/task-graph/types.js";

export const ExecutionTaskSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  phaseId: z.string().uuid().optional().nullable(),
  subphaseId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  type: z.enum(["code", "config", "test", "docs", "review", "deploy", "pending_input", "other"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z
    .enum(["pending", "blocked", "ready", "in_progress", "complete", "needs_review"])
    .default("pending"),
  order: z.number().int().default(0),
  version: z.number().int().positive().default(1),
  supersededByTaskId: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExecutionTask = z.infer<typeof ExecutionTaskSchema>;

const graphStore = createInMemoryGraphStore();
const promptStore = createInMemoryPromptStore();

export async function registerExecutionTaskRoutes(app: FastifyInstance) {
  app.get("/api/v1/plans/:planId/tasks", async (request) => {
    const { planId } = request.params as { planId: string };

    let graph = graphStore.getGraph(planId, 1);

    if (!graph) {
      const phases: PhaseInput[] = [
        {
          phaseType: "ideation",
          phaseName: "Ideation",
          status: "sufficient",
          confidence: 0.8,
          summary: "Project scaffold",
        },
        {
          phaseType: "requirements",
          phaseName: "Requirements",
          status: "sufficient",
          confidence: 0.8,
          summary: "User stories",
        },
        {
          phaseType: "architecture",
          phaseName: "Architecture",
          status: "sufficient",
          confidence: 0.8,
          summary: "System design",
        },
        {
          phaseType: "security",
          phaseName: "Security",
          status: "sufficient",
          confidence: 0.7,
          summary: "Auth & encryption",
        },
        {
          phaseType: "database",
          phaseName: "Database",
          status: "sufficient",
          confidence: 0.8,
          summary: "Schema design",
        },
        {
          phaseType: "backend",
          phaseName: "Backend",
          status: "sufficient",
          confidence: 0.8,
          summary: "API implementation",
        },
        {
          phaseType: "frontend",
          phaseName: "Frontend",
          status: "sufficient",
          confidence: 0.8,
          summary: "UI components",
        },
        {
          phaseType: "core-features",
          phaseName: "Core Features",
          status: "sufficient",
          confidence: 0.7,
          summary: "Feature modules",
        },
        {
          phaseType: "ai-systems",
          phaseName: "AI Systems",
          status: "sufficient",
          confidence: 0.6,
          summary: "AI integration",
        },
        {
          phaseType: "testing",
          phaseName: "Testing",
          status: "sufficient",
          confidence: 0.8,
          summary: "Test suites",
        },
        {
          phaseType: "deployment",
          phaseName: "Deployment",
          status: "sufficient",
          confidence: 0.7,
          summary: "CI/CD config",
        },
        {
          phaseType: "monitoring",
          phaseName: "Monitoring",
          status: "sufficient",
          confidence: 0.6,
          summary: "Observability",
        },
      ];
      graph = generateTasks(planId, 1, phases);
      graphStore.saveGraph(graph);

      const allTasks = graph.tasks;
      for (const task of allTasks) {
        assemblePrompt(
          {
            task,
            planName: "Project",
            allTasks,
            predecessorOutputs: [],
            phaseSummary: task.phaseType,
          },
          promptStore,
        );
      }
    }

    return { planId, planVersion: graph.planVersion, tasks: graph.tasks, dependencies: graph.dependencies };
  });

  app.get("/api/v1/plans/:planId/tasks/:taskId/prompt", async (request) => {
    const { taskId } = request.params as { taskId: string };
    const prompt = promptStore.getByTask(taskId);
    if (!prompt) throw new NotFoundError("Prompt", taskId);
    return prompt;
  });

  app.get("/api/v1/plans/:planId/prompts/export", async (request) => {
    const { planId } = request.params as { planId: string };
    const graph = graphStore.getGraph(planId, 1);
    if (!graph) throw new NotFoundError("Plan", planId);

    const prompts = promptStore.getByPlan(planId, 1);
    const tasks = graph.tasks;

    const missingPrompts = tasks.filter((t) => !prompts.find((p) => p.taskId === t.id));
    const tasksWithNullPrompt = tasks.filter((t) => {
      const p = prompts.find((p) => p.taskId === t.id);
      return p && !p.promptText;
    });

    const warnings: string[] = [];
    if (missingPrompts.length > 0) {
      warnings.push(`${missingPrompts.length} task(s) have no prompt artifact`);
    }
    if (tasksWithNullPrompt.length > 0) {
      warnings.push(`${tasksWithNullPrompt.length} task(s) have empty prompt text`);
    }

    const bundle = {
      exportFormat: "orchestra-prompt-bundle-v1",
      exportedAt: new Date().toISOString(),
      planId,
      planVersion: 1,
      taskCount: tasks.length,
      promptCount: prompts.length,
      warnings: warnings.length > 0 ? warnings : undefined,
      tasks: tasks.map((t) => {
        const prompt = prompts.find((p) => p.taskId === t.id);
        return {
          order: t.order,
          phaseType: t.phaseType,
          title: t.title,
          type: t.type,
          priority: t.priority,
          status: t.status,
          dependencies: t.dependencies,
          acceptanceCriteria: t.acceptanceCriteria,
          promptText: prompt?.promptText ?? null,
        };
      }),
      metadata: {
        generatedAt: prompts[0]?.createdAt ?? null,
        graphVersion: 1,
      },
    };

    return bundle;
  });
}
