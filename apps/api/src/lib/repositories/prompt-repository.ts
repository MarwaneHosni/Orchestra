import { eq } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import type { PromptStore, PromptArtifact } from "../prompt/types.js";

export function createSqlitePromptStore(): PromptStore {
  const now = () => new Date().toISOString();

  return {
    save(a) {
      getDb()
        .insert(schema.promptArtifacts)
        .values({
          id: a.id,
          taskId: a.taskId,
          promptText: a.promptText,
          resultText: null,
          version: a.version,
          status: a.status,
          failureReason: a.failureReason,
          createdAt: now(),
          updatedAt: now(),
        })
        .run();
    },
    getByTask(taskId) {
      const rows = getDb()
        .select()
        .from(schema.promptArtifacts)
        .where(eq(schema.promptArtifacts.taskId, taskId))
        .all();
      if (rows.length === 0) return undefined;
      const row = rows[rows.length - 1]!;
      return {
        id: row.id,
        taskId: row.taskId,
        planId: "",
        planVersion: 0,
        promptText: row.promptText,
        sections: {
          objective: "",
          context: "",
          constraints: [],
          expectedOutput: "",
          validationCriteria: [],
          architecturalAlignment: "",
          agentTips: { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] },
        },
        version: row.version,
        status: row.status as PromptArtifact["status"],
        failureReason: row.failureReason,
        createdAt: row.createdAt,
      };
    },
    getByPlan(planId, planVersion) {
      const rows = getDb().select().from(schema.promptArtifacts).all();
      return rows.map((r) => ({
        id: r.id,
        taskId: r.taskId,
        planId,
        planVersion,
        promptText: r.promptText ?? "",
        sections: {
          objective: "",
          context: "",
          constraints: [],
          expectedOutput: "",
          validationCriteria: [],
          architecturalAlignment: "",
          agentTips: { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] },
        },
        version: r.version,
        status: r.status as PromptArtifact["status"],
        failureReason: r.failureReason,
        createdAt: r.createdAt,
      }));
    },
  };
}
