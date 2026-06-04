import { eq, and, or, sql } from "drizzle-orm";
import { getDb, runTransaction } from "../../db/sqlite/index.js";
import * as schema from "../../db/sqlite/schema/index.js";
import type { SessionStore } from "../orchestration/store.js";
import type { SessionRecord, AnswerRecord, BlueprintRecord } from "../orchestration/types.js";

function toSessionRecord(row: typeof schema.interviewSessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as SessionRecord["status"],
    currentPhaseIndex: row.currentPhaseIndex,
    currentQuestionIndex: row.currentQuestionIndex,
    mode: "quick",
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAnswerRecord(row: typeof schema.answers.$inferSelect): AnswerRecord {
  return {
    id: row.id,
    questionId: row.questionId,
    projectId: "",
    sessionId: row.sessionId,
    value: row.value,
    confidence: row.confidence as string,
    provenance: row.provenance as string,
    version: row.version,
    isLatest: row.isLatest as unknown as boolean,
    createdAt: row.createdAt,
    supersededAt: row.supersededAt,
  };
}

function toBlueprintRecord(row: typeof schema.blueprints.$inferSelect): BlueprintRecord {
  return {
    id: row.id,
    planId: row.planId,
    projectId: row.projectId,
    content: row.content,
    format: row.format as string,
    version: row.version,
    status: row.status as string,
    staleAt: row.staleAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createSqliteSessionStore(): SessionStore {
  const now = () => new Date().toISOString();

  return {
    insertProject(r) {
      getDb()
        .insert(schema.projects)
        .values({
          id: r.id,
          name: r.name,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        } as any)
        .run();
    },
    getProject(id) {
      const row = getDb().select().from(schema.projects).where(eq(schema.projects.id, id)).get();
      if (!row) return undefined;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
    getAllProjects() {
      return getDb().select().from(schema.projects).orderBy(schema.projects.createdAt).all() as any;
    },

    insertIdea(r) {
      getDb()
        .insert(schema.ideas)
        .values(r as any)
        .run();
    },

    insertSession(r) {
      getDb()
        .insert(schema.interviewSessions)
        .values(r as any)
        .run();
    },
    updateSession(id, partial) {
      const updates: Record<string, unknown> = {};
      if (partial.status !== undefined) updates.status = partial.status;
      if (partial.currentPhaseIndex !== undefined) updates.currentPhaseIndex = partial.currentPhaseIndex;
      if (partial.currentQuestionIndex !== undefined)
        updates.currentQuestionIndex = partial.currentQuestionIndex;
      if (partial.startedAt !== undefined) updates.startedAt = partial.startedAt;
      if (partial.completedAt !== undefined) updates.completedAt = partial.completedAt;
      updates.updatedAt = now();
      getDb()
        .update(schema.interviewSessions)
        .set(updates as any)
        .where(eq(schema.interviewSessions.id, id))
        .run();
    },
    getSession(id) {
      const row = getDb()
        .select()
        .from(schema.interviewSessions)
        .where(eq(schema.interviewSessions.id, id))
        .get();
      return row ? toSessionRecord(row) : undefined;
    },
    getSessionsByProject(projectId) {
      return getDb()
        .select()
        .from(schema.interviewSessions)
        .where(eq(schema.interviewSessions.projectId, projectId))
        .all()
        .map(toSessionRecord);
    },

    insertAnswer(r) {
      getDb()
        .insert(schema.answers)
        .values(r as any)
        .run();
    },
    getAnswersBySession(sessionId) {
      return getDb()
        .select()
        .from(schema.answers)
        .where(eq(schema.answers.sessionId, sessionId))
        .all()
        .map(toAnswerRecord);
    },
    getLatestAnswersBySession(sessionId) {
      return getDb()
        .select()
        .from(schema.answers)
        .where(and(eq(schema.answers.sessionId, sessionId), sql`${schema.answers.isLatest} = 1`))
        .all()
        .map(toAnswerRecord);
    },
    supersedeAnswer(sessionId, questionId) {
      getDb()
        .update(schema.answers)
        .set({ isLatest: 0 as any, supersededAt: now() })
        .where(and(eq(schema.answers.sessionId, sessionId), eq(schema.answers.questionId, questionId)))
        .run();
    },

    insertPlan(r) {
      getDb()
        .insert(schema.plans)
        .values(r as any)
        .run();
    },
    getPlansByProject(projectId) {
      return getDb().select().from(schema.plans).where(eq(schema.plans.projectId, projectId)).all() as any;
    },
    markPlansStaleBySession(sessionId) {
      const sess = this.getSession(sessionId);
      if (!sess) return;
      const n = now();
      getDb()
        .update(schema.plans)
        .set({ staleAt: n })
        .where(and(eq(schema.plans.projectId, sess.projectId), sql`${schema.plans.staleAt} IS NULL`))
        .run();
    },

    insertBlueprint(r) {
      getDb()
        .insert(schema.blueprints)
        .values(r as any)
        .run();
    },
    getBlueprintsByProject(projectId) {
      return getDb()
        .select()
        .from(schema.blueprints)
        .where(eq(schema.blueprints.projectId, projectId))
        .all()
        .map(toBlueprintRecord);
    },
    markBlueprintsStaleBySession(sessionId) {
      const sess = this.getSession(sessionId);
      if (!sess) return;
      const n = now();
      getDb()
        .update(schema.blueprints)
        .set({ staleAt: n })
        .where(
          and(eq(schema.blueprints.projectId, sess.projectId), sql`${schema.blueprints.staleAt} IS NULL`),
        )
        .run();
    },
    deleteProject(projectId) {
      // Collect plan and session IDs for this project
      const planRows = getDb().select({ id: schema.plans.id })
        .from(schema.plans).where(eq(schema.plans.projectId, projectId)).all();
      const sessionRows = getDb().select({ id: schema.interviewSessions.id })
        .from(schema.interviewSessions).where(eq(schema.interviewSessions.projectId, projectId)).all();

      // Wrap all deletions in a transaction for atomicity
      runTransaction(() => {
        // prompt_artifacts has no FK — delete by planId
        for (const p of planRows) {
          getDb().delete(schema.promptArtifacts).where(eq(schema.promptArtifacts.planId, p.id)).run();
        }

        // execution_tasks → task_dependencies
        for (const p of planRows) {
          const taskRows = getDb().select({ id: schema.executionTasks.id })
            .from(schema.executionTasks).where(eq(schema.executionTasks.planId, p.id)).all();
          for (const t of taskRows) {
            getDb().delete(schema.taskDependencies)
              .where(or(eq(schema.taskDependencies.taskId, t.id),
                        eq(schema.taskDependencies.dependsOnTaskId, t.id)))
              .run();
          }
          for (const t of taskRows) {
            getDb().delete(schema.executionTasks).where(eq(schema.executionTasks.id, t.id)).run();
          }
        }

        // Tables with FK → plans
        for (const p of planRows) {
          getDb().delete(schema.taskGraphs).where(eq(schema.taskGraphs.planId, p.id)).run();
          getDb().delete(schema.workflowRuns).where(eq(schema.workflowRuns.planId, p.id)).run();
          getDb().delete(schema.analysisResults).where(eq(schema.analysisResults.planId, p.id)).run();
          getDb().delete(schema.blueprints).where(eq(schema.blueprints.planId, p.id)).run();
        }
        for (const p of planRows) {
          getDb().delete(schema.plans).where(eq(schema.plans.id, p.id)).run();
        }

        // Tables with FK → interview_sessions
        for (const s of sessionRows) {
          getDb().delete(schema.answers).where(eq(schema.answers.sessionId, s.id)).run();
        }
        for (const s of sessionRows) {
          getDb().delete(schema.interviewSessions).where(eq(schema.interviewSessions.id, s.id)).run();
        }

        // Tables with FK → projects
        getDb().delete(schema.ideas).where(eq(schema.ideas.projectId, projectId)).run();
        getDb().delete(schema.usageRecords).where(eq(schema.usageRecords.projectId, projectId)).run();
        getDb().delete(schema.activityLog).where(eq(schema.activityLog.projectId, projectId)).run();

        // Project itself — cascade handles the rest if available, but explicit
        // deletes above handle it for databases created before CASCADE was added
        getDb().delete(schema.projects).where(eq(schema.projects.id, projectId)).run();
      });
    },
  };
}
