import { eq, and } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import type { GraphStore } from "../task-graph/generator.js";
import type { TaskGraph, TaskNode, DepType } from "../task-graph/types.js";

export function createSqliteGraphStore(): GraphStore {
  const now = () => new Date().toISOString();

  return {
    saveGraph(g) {
      const existing = getDb()
        .select()
        .from(schema.taskGraphs)
        .where(and(eq(schema.taskGraphs.planId, g.planId), eq(schema.taskGraphs.graphVersion, g.planVersion)))
        .get();
      if (existing) return;

      const planRow = getDb().select().from(schema.plans).where(eq(schema.plans.id, g.planId)).get();
      const projectId = planRow?.projectId ?? "";
      const graphId = crypto.randomUUID();

      getDb()
        .insert(schema.taskGraphs)
        .values({
          id: graphId,
          planId: g.planId,
          projectId,
          planVersion: g.planVersion,
          graphVersion: g.planVersion,
          status: "complete",
          taskCount: g.tasks.length,
          dependencyCount: g.dependencies.length,
          createdAt: now(),
          updatedAt: now(),
        })
        .run();

      for (const t of g.tasks) {
        getDb()
          .insert(schema.executionTasks)
          .values({
            id: t.id,
            planId: t.planId,
            phaseType: t.phaseType,
            title: t.title,
            description: `${t.type}:${t.priority}`,
            type: t.type as any,
            priority: t.priority as any,
            status: t.status as any,
            order: t.order,
            version: 1,
            createdAt: now(),
            updatedAt: now(),
          })
          .run();
      }

      for (const d of g.dependencies) {
        getDb()
          .insert(schema.taskDependencies)
          .values({
            id: crypto.randomUUID(),
            taskId: d.taskId,
            dependsOnTaskId: d.dependsOnTaskId,
            dependencyType: d.dependencyType as any,
            createdAt: now(),
          })
          .run();
      }
    },
    getGraph(planId, version) {
      const graphRow = getDb()
        .select()
        .from(schema.taskGraphs)
        .where(and(eq(schema.taskGraphs.planId, planId), eq(schema.taskGraphs.graphVersion, version)))
        .get();
      if (!graphRow) return undefined;

      const tasks = getDb()
        .select()
        .from(schema.executionTasks)
        .where(eq(schema.executionTasks.planId, planId))
        .all();

      const deps = getDb().select().from(schema.taskDependencies).all();

      const taskNodes: TaskNode[] = tasks.map((t) => ({
        id: t.id,
        planId: t.planId,
        phaseType: t.phaseType ?? "",
        title: t.title,
        type: t.type as TaskNode["type"],
        priority: t.priority as TaskNode["priority"],
        status: t.status as TaskNode["status"],
        order: t.order,
        dependencies: [],
        acceptanceCriteria: [],
        estimatedPromptRounds: 3,
      }));

      for (const node of taskNodes) {
        node.dependencies = deps
          .filter((d) => d.taskId === node.id)
          .map((d) => ({
            taskId: d.dependsOnTaskId,
            type: d.dependencyType as DepType,
          }));
      }

      return {
        planId: graphRow.planId,
        planVersion: graphRow.planVersion,
        tasks: taskNodes,
        dependencies: deps.map((d) => ({
          taskId: d.taskId,
          dependsOnTaskId: d.dependsOnTaskId,
          dependencyType: d.dependencyType as DepType,
        })),
      };
    },
    getGraphsByPlan(planId) {
      const rows = getDb().select().from(schema.taskGraphs).where(eq(schema.taskGraphs.planId, planId)).all();
      const graphs: TaskGraph[] = [];
      for (const row of rows) {
        const g = this.getGraph(planId, row.graphVersion);
        if (g) graphs.push(g);
      }
      return graphs;
    },
    updateTaskStatus(planId, planVersion, taskId, newStatus) {
      const graph = this.getGraph(planId, planVersion);
      if (!graph) return undefined;
      const task = graph.tasks.find((t) => t.id === taskId);
      if (!task) return undefined;
      task.status = newStatus as TaskNode["status"];
      getDb()
        .update(schema.executionTasks)
        .set({ status: newStatus as any, updatedAt: now() })
        .where(eq(schema.executionTasks.id, taskId))
        .run();
      return { ...task };
    },
  };
}
