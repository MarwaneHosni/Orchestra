import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateTasks, deriveGraph } from "../lib/task-graph/generator.js";
import { assemblePrompt } from "../lib/prompt/index.js";
import { graphStore, promptStore } from "../lib/shared-stores.js";
import { NotFoundError, RateLimitedError } from "../lib/errors.js";
import { GuardrailService } from "../lib/budget/guardrail.js";
import { createInMemoryBudgetStore } from "../lib/budget/budget.js";
import { getTracer } from "../lib/metrics/index.js";
import type { PhaseInput } from "../lib/task-graph/types.js";

const exportGuardrail = new GuardrailService(createInMemoryBudgetStore(), {
  rateLimitExport: { maxRequests: 30, windowMs: 60_000 },
});

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

function defaultPhases(): PhaseInput[] {
  return [
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
}

export async function registerExecutionTaskRoutes(app: FastifyInstance) {
  app.get("/api/v1/plans/:planId/tasks", async (request) => {
    const tracer = getTracer();
    const span = tracer.startSpan("tasks.list");

    const { planId } = request.params as { planId: string };
    const query = request.query as { version?: string };
    const requestedVersion = query.version ? parseInt(query.version, 10) : 1;

    if (isNaN(requestedVersion) || requestedVersion < 1) {
      tracer.endSpan(span, "error", "version must be a positive integer");
      throw new Error("version must be a positive integer");
    }

    try {
      let graph = graphStore.getGraph(planId, requestedVersion);

      if (!graph) {
        const existingGraphs = graphStore.getGraphsByPlan(planId);

        // If version 1 not found, try the latest stored version
        if (requestedVersion === 1 && existingGraphs.length > 0) {
          const latest = Math.max(...existingGraphs.map((g) => g.planVersion));
          graph = graphStore.getGraph(planId, latest);
        }

        if (!graph) {
          const phases = defaultPhases();
          const genSpan = tracer.startSpan("tasks.generate", span.spanId);

          try {
            if (requestedVersion === 1) {
              graph = generateTasks(planId, 1, phases);
            } else if (existingGraphs.length === 0) {
              graph = generateTasks(planId, requestedVersion, phases);
            } else {
              const sourceVersion = Math.max(...existingGraphs.map((g) => g.planVersion));
              const sourceGraph = existingGraphs.find((g) => g.planVersion === sourceVersion)!;
              graph = deriveGraph(planId, requestedVersion, phases, sourceGraph);
            }
            tracer.endSpan(genSpan, "ok");
          } catch (err) {
            tracer.endSpan(genSpan, "error", err instanceof Error ? err.message : String(err));
            throw err;
          }

          graphStore.saveGraph(graph);
        }
      }

      span.tags["planId"] = planId;
      span.tags["planVersion"] = String(graph.planVersion);
      span.tags["taskCount"] = String(graph.tasks.length);
      tracer.endSpan(span, "ok");

      return { planId, planVersion: graph.planVersion, tasks: graph.tasks, dependencies: graph.dependencies };
    } catch (err) {
      tracer.endSpan(span, "error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  app.get("/api/v1/plans/:planId/tasks/:taskId/prompt", async (request) => {
    const { planId, taskId } = request.params as { planId: string; taskId: string };
    let prompt = promptStore.getByTask(taskId);
    if (prompt) {
      console.log(
        "[PROMPT DEBUG]",
        JSON.stringify({
          step: "found_in_store",
          taskId,
          planId,
          promptLength: prompt.promptText.length,
          isAiGenerated: prompt.sections.objective === "",
        }),
      );
      return prompt;
    }
    console.log(
      "[PROMPT DEBUG]",
      JSON.stringify({
        step: "not_in_store_fallback",
        taskId,
        planId,
        planPromptCount: promptStore.getByPlan(planId, 1)?.length ?? 0,
        graphCount: graphStore.getGraphsByPlan(planId).length,
      }),
    );
    const graph = graphStore.getGraphsByPlan(planId);
    if (graph.length === 0) throw new NotFoundError("Plan", planId);
    const latestGraph = graph.reduce((a, b) => (a.planVersion > b.planVersion ? a : b));
    const task = latestGraph.tasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundError("Task", taskId);
    prompt = assemblePrompt(
      {
        task,
        planName: "Project",
        allTasks: latestGraph.tasks,
        predecessorOutputs: [],
        phaseSummary: task.phaseType,
      },
      promptStore,
      latestGraph.planVersion,
    );
    return prompt;
  });

  app.get("/api/v1/plans/:planId/prompts/export", async (request) => {
    const tracer = getTracer();
    const span = tracer.startSpan("export.bundle");

    const exportCheck = exportGuardrail.checkExport("system");
    if (!exportCheck.allowed) {
      tracer.endSpan(span, "error", exportCheck.reason ?? "Export rate limit exceeded");
      throw new RateLimitedError(
        exportCheck.reason ?? "Export rate limit exceeded",
        exportCheck.retryAfterMs ?? 60_000,
        "export",
      );
    }

    try {
      const { planId } = request.params as { planId: string };
      const query = request.query as { version?: string };
      const requestedVersion = query.version ? parseInt(query.version, 10) : 1;

      if (isNaN(requestedVersion) || requestedVersion < 1) {
        tracer.endSpan(span, "error", "version must be a positive integer");
        throw new Error("version must be a positive integer");
      }

      const graph = graphStore.getGraph(planId, requestedVersion);
      if (!graph) {
        tracer.endSpan(span, "error", `Plan ${planId} not found`);
        throw new NotFoundError("Plan", planId);
      }

      const prompts = promptStore.getByPlan(planId, requestedVersion);
      const tasks = graph.tasks;
      const promptMap = new Map(prompts.map((p) => [p.taskId, p]));

      let missingCount = 0;
      let nullTextCount = 0;
      for (const t of tasks) {
        const p = promptMap.get(t.id);
        if (!p) missingCount++;
        else if (!p.promptText) nullTextCount++;
      }

      const warnings: string[] = [];
      if (missingCount > 0) warnings.push(`${missingCount} task(s) have no prompt artifact`);
      if (nullTextCount > 0) warnings.push(`${nullTextCount} task(s) have empty prompt text`);

      span.tags["planId"] = planId;
      span.tags["planVersion"] = String(graph.planVersion);
      span.tags["taskCount"] = String(tasks.length);
      span.tags["promptCount"] = String(prompts.length);
      tracer.endSpan(span, "ok");

      const bundle = {
        exportFormat: "orchestra-prompt-bundle-v1",
        exportedAt: new Date().toISOString(),
        planId,
        planVersion: graph.planVersion,
        derivedFromPlanVersion: graph.derivedFromPlanVersion ?? null,
        taskCount: tasks.length,
        promptCount: prompts.length,
        warnings: warnings.length > 0 ? warnings : undefined,
        tasks: tasks.map((t) => {
          const prompt = promptMap.get(t.id);
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
            promptValidationStatus: prompt?.status ?? null,
            promptFailureReason: prompt?.failureReason ?? null,
          };
        }),
        metadata: {
          generatedAt: prompts[0]?.createdAt ?? null,
          graphVersion: graph.planVersion,
        },
      };

      return bundle;
    } catch (err) {
      tracer.endSpan(span, "error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });
}
