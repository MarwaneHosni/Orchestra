import { eq, and } from "drizzle-orm";
import { getDb } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import type { PromptStore, PromptArtifact, PromptSection } from "../prompt/types.js";

function serializeSections(sections: PromptSection): string {
  return JSON.stringify(sections);
}

function deserializeSections(json: string | null | undefined): PromptSection {
  if (!json) {
    return {
      objective: "",
      context: "",
      constraints: [],
      expectedOutput: "",
      validationCriteria: [],
      architecturalAlignment: "",
      agentTips: { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] },
    };
  }
  try {
    return JSON.parse(json) as PromptSection;
  } catch {
    return {
      objective: "",
      context: "",
      constraints: [],
      expectedOutput: "",
      validationCriteria: [],
      architecturalAlignment: "",
      agentTips: { security: [], edgeCases: [], dependencyWarnings: [], commonBugs: [] },
    };
  }
}

export function createSqlitePromptStore(): PromptStore {
  const now = () => new Date().toISOString();

  return {
    save(a) {
      getDb()
        .insert(schema.promptArtifacts)
        .values({
          id: a.id,
          taskId: a.taskId,
          planId: a.planId,
          planVersion: a.planVersion,
          promptText: a.promptText,
          sectionsJson: serializeSections(a.sections),
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
        planId: row.planId ?? "",
        planVersion: row.planVersion ?? 0,
        promptText: row.promptText,
        sections: deserializeSections(row.sectionsJson),
        version: row.version,
        status: row.status as PromptArtifact["status"],
        failureReason: row.failureReason,
        createdAt: row.createdAt,
      };
    },
    getByPlan(planId, planVersion) {
      const rows = getDb()
        .select()
        .from(schema.promptArtifacts)
        .where(
          and(
            eq(schema.promptArtifacts.planId, planId),
            eq(schema.promptArtifacts.planVersion, planVersion),
          ),
        )
        .all();
      return rows.map((r) => ({
        id: r.id,
        taskId: r.taskId,
        planId: r.planId ?? "",
        planVersion: r.planVersion ?? 0,
        promptText: r.promptText ?? "",
        sections: deserializeSections(r.sectionsJson),
        version: r.version,
        status: r.status as PromptArtifact["status"],
        failureReason: r.failureReason,
        createdAt: r.createdAt,
      }));
    },
  };
}
