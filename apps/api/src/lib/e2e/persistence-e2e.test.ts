import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { existsSync, unlinkSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initDb, closeDb, isInitialized, rawRun, rawGet } from "../../db/sqlite/index.js";
import { createTables } from "../../db/sqlite/bootstrap.js";

// ── Test Setup ────────────────────────────────────────────────────────

let tmpDir: string;
let dbPath: string;
const origEnv = { ...process.env };

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "orchestra-persist-"));
  dbPath = join(tmpDir, "test.db");
  process.env.SQLITE_DB_PATH = dbPath;
});

afterAll(() => {
  closeDb();
  if (existsSync(dbPath)) unlinkSync(dbPath);
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  process.env = origEnv;
});

function uuid(): string {
  return crypto.randomUUID();
}
function now(): string {
  return new Date().toISOString();
}

async function resetDb() {
  if (isInitialized()) {
    closeDb();
    if (existsSync(dbPath)) unlinkSync(dbPath);
  }
  await initDb();
  createTables();
}

function insert(table: string, data: Record<string, unknown>): void {
  const keys = Object.keys(data);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const vals = keys.map(() => "?").join(", ");
  rawRun(`INSERT INTO ${table} (${cols}) VALUES (${vals})`, ...keys.map((k) => data[k]));
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("SQLite Persistence Layer", () => {
  beforeAll(async () => {
    await resetDb();
  });

  // ── DB Init ───────────────────────────────────────────────────────

  describe("Database initialization", () => {
    it("initializes and creates database file", () => {
      expect(isInitialized()).toBe(true);
    });

    it("is idempotent", async () => {
      const db1 = rawGet("SELECT 1 as v");
      await initDb();
      createTables();
      const db2 = rawGet("SELECT 1 as v");
      expect(db1).toEqual(db2);
    });
  });

  // ── Project persistence ───────────────────────────────────────────

  describe("Project persistence", () => {
    it("saves and loads a project", () => {
      const id = uuid();
      insert("projects", {
        id,
        name: "Test Project",
        description: "Test desc",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      const res = rawGet("SELECT * FROM projects WHERE id = ?", id);
      expect(res).toBeDefined();
      expect(res!.name).toBe("Test Project");
    });

    it("survives close and reopen (simulated restart)", async () => {
      const id = uuid();
      insert("projects", {
        id,
        name: "Restart Test",
        description: "Should survive",
        status: "active",
        created_at: now(),
        updated_at: now(),
      });

      // Verify it's in the DB before restart
      const before = rawGet("SELECT * FROM projects WHERE id = ?", id);
      expect(before).toBeDefined();
      expect(before!.name).toBe("Restart Test");

      closeDb();
      await initDb();
      createTables();

      const after = rawGet("SELECT * FROM projects WHERE id = ?", id);
      expect(after).toBeDefined();
      expect(after!.name).toBe("Restart Test");
      expect(after!.status).toBe("active");
    });

    it("loads all projects", () => {
      const res = rawGet("SELECT COUNT(*) as cnt FROM projects");
      expect(Number(res!.cnt)).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Interview session persistence ──────────────────────────────────

  describe("Interview session persistence", () => {
    it("saves and loads a session", () => {
      const projectId = uuid();
      const sessionId = uuid();
      insert("projects", {
        id: projectId,
        name: "Session Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("interview_sessions", {
        id: sessionId,
        project_id: projectId,
        status: "in_progress",
        current_phase_index: 0,
        current_question_index: 0,
        started_at: now(),
        created_at: now(),
        updated_at: now(),
      });
      const res = rawGet("SELECT * FROM interview_sessions WHERE id = ?", sessionId);
      expect(res).toBeDefined();
      expect(res!.status).toBe("in_progress");
    });

    it("survives restart", async () => {
      const projectId = uuid();
      const sessionId = uuid();
      insert("projects", {
        id: projectId,
        name: "Session Restart Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("interview_sessions", {
        id: sessionId,
        project_id: projectId,
        status: "completed",
        current_phase_index: 5,
        current_question_index: 3,
        started_at: now(),
        completed_at: now(),
        created_at: now(),
        updated_at: now(),
      });

      closeDb();
      await initDb();
      createTables();

      const res = rawGet("SELECT * FROM interview_sessions WHERE id = ?", sessionId);
      expect(res).toBeDefined();
      expect(Number(res!.current_phase_index)).toBe(5);
      expect(res!.status).toBe("completed");
    });
  });

  // ── Answer persistence ────────────────────────────────────────────

  describe("Answer persistence", () => {
    it("saves and loads versioned answers", () => {
      const projectId = uuid();
      const sessionId = uuid();
      const answerId = uuid();
      insert("projects", {
        id: projectId,
        name: "Answer Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("interview_sessions", {
        id: sessionId,
        project_id: projectId,
        status: "in_progress",
        current_phase_index: 0,
        current_question_index: 0,
        started_at: now(),
        created_at: now(),
        updated_at: now(),
      });
      insert("answers", {
        id: answerId,
        question_id: "ideation.1",
        session_id: sessionId,
        value: "Test answer",
        confidence: "high",
        provenance: "user",
        version: 1,
        is_latest: 1,
        created_at: now(),
      });
      const res = rawGet("SELECT * FROM answers WHERE id = ?", answerId);
      expect(res).toBeDefined();
      expect(res!.value).toBe("Test answer");
      expect(Number(res!.is_latest)).toBe(1);
    });

    it("supports versioned supersede pattern", async () => {
      const projectId = uuid();
      const sessionId = uuid();
      const answerId1 = uuid();
      const answerId2 = uuid();
      insert("projects", {
        id: projectId,
        name: "Version Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("interview_sessions", {
        id: sessionId,
        project_id: projectId,
        status: "in_progress",
        current_phase_index: 0,
        current_question_index: 0,
        started_at: now(),
        created_at: now(),
        updated_at: now(),
      });

      // Version 1
      rawRun(
        "INSERT INTO answers (id, question_id, session_id, value, confidence, provenance, version, is_latest, created_at) VALUES (?, 'ideation.1', ?, 'Original', 'medium', 'user', 1, 1, ?)",
        answerId1,
        sessionId,
        now(),
      );

      const v1row = rawGet("SELECT value, is_latest FROM answers WHERE id = ?", answerId1);
      expect(v1row).toBeDefined();
      expect(v1row!.value).toBe("Original");
      expect(Number(v1row!.is_latest)).toBe(1);

      // Add a second version
      rawRun(
        "INSERT INTO answers (id, question_id, session_id, value, confidence, provenance, version, is_latest, created_at) VALUES (?, 'ideation.1', ?, 'Edited', 'high', 'user', 2, 1, ?)",
        answerId2,
        sessionId,
        now(),
      );

      const v2row = rawGet("SELECT value, is_latest FROM answers WHERE id = ?", answerId2);
      expect(v2row).toBeDefined();
      expect(v2row!.value).toBe("Edited");
      expect(Number(v2row!.is_latest)).toBe(1);

      // Both rows for this session should be latest
      const cntBefore = rawGet(
        "SELECT COUNT(*) as cnt FROM answers WHERE session_id = ? AND is_latest = 1",
        sessionId,
      );
      expect(cntBefore).toBeDefined();
      expect(Number(cntBefore!.cnt)).toBe(2);

      // Supersede using raw SQL
      rawRun(
        "UPDATE answers SET is_latest = 0, superseded_at = ? WHERE session_id = ? AND question_id = ?",
        now(),
        sessionId,
        "ideation.1",
      );

      // Now should have 0 latest for this session
      expect(
        Number(
          rawGet("SELECT COUNT(*) as cnt FROM answers WHERE session_id = ? AND is_latest = 1", sessionId)!
            .cnt,
        ),
      ).toBe(0);

      const v1 = rawGet("SELECT is_latest FROM answers WHERE id = ?", answerId1);
      expect(Number(v1!.is_latest)).toBe(0); // v1 is no longer latest

      const edited = rawGet("SELECT value FROM answers WHERE id = ?", answerId2);
      expect(edited!.value).toBe("Edited");
    });
  });

  // ── Blueprint persistence ─────────────────────────────────────────

  describe("Blueprint persistence", () => {
    it("saves and loads blueprint JSON", () => {
      const projectId = uuid();
      const planId = uuid();
      const bpId = uuid();
      insert("projects", {
        id: projectId,
        name: "BP Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "complete",
        created_at: now(),
        updated_at: now(),
      });
      insert("blueprints", {
        id: bpId,
        plan_id: planId,
        project_id: projectId,
        content: JSON.stringify({ phases: [], confidence: 0.9 }),
        format: "json",
        version: 1,
        status: "complete",
        created_at: now(),
        updated_at: now(),
      });
      const res = rawGet("SELECT * FROM blueprints WHERE id = ?", bpId);
      expect(res).toBeDefined();
      const content = JSON.parse(res!.content as string);
      expect(content.confidence).toBe(0.9);
    });
  });

  // ── Workflow state persistence ────────────────────────────────────

  describe("Workflow state persistence", () => {
    it("creates and tracks a workflow through all states", async () => {
      const mod = await import("../../lib/repositories/workflow-repository.js");
      const projectId = uuid();
      const planId = uuid();
      insert("projects", {
        id: projectId,
        name: "WF Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "generating",
        created_at: now(),
        updated_at: now(),
      });

      mod.createWorkflowRun("wf-1", planId);
      const created = mod.getWorkflowRun("wf-1");
      expect(created).toBeDefined();
      expect(created!.status).toBe("running");
      expect(created!.stepStatuses.synthesis).toBe("running");
      expect(created!.stepStatuses.analysis).toBe("pending");

      // Steps go pending → running → completed
      mod.updateWorkflowStep("wf-1", "synthesis", "completed");
      expect(mod.getWorkflowRun("wf-1")!.stepStatuses.synthesis).toBe("completed");

      mod.updateWorkflowStep("wf-1", "analysis", "running");
      mod.updateWorkflowStep("wf-1", "analysis", "completed");
      mod.updateWorkflowStep("wf-1", "blueprint", "running");
      mod.updateWorkflowStep("wf-1", "blueprint", "completed");
      mod.completeWorkflowRun("wf-1", "completed", "opencode-go", "deepseek-v4-flash");

      const run = mod.getWorkflowRun("wf-1");
      expect(run).toBeDefined();
      expect(run!.status).toBe("completed");
      expect(run!.stepStatuses.synthesis).toBe("completed");
      expect(run!.stepStatuses.analysis).toBe("completed");

      // Check provider and model via raw SQL
      const row = rawGet("SELECT provider, model FROM workflow_runs WHERE id = ?", "wf-1");
      expect(row!.provider).toBe("opencode-go");
      expect(row!.model).toBe("deepseek-v4-flash");
    });

    it("rejects invalid step transitions", async () => {
      const mod = await import("../../lib/repositories/workflow-repository.js");
      const projectId = uuid();
      const planId = uuid();
      insert("projects", {
        id: projectId,
        name: "Invalid Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "generating",
        created_at: now(),
        updated_at: now(),
      });

      mod.createWorkflowRun("wf-invalid", planId);
      mod.updateWorkflowStep("wf-invalid", "synthesis", "completed");
      expect(() => {
        mod.updateWorkflowStep("wf-invalid", "synthesis", "running");
      }).toThrow();
    });

    it("rejects invalid workflow status transitions", async () => {
      const mod = await import("../../lib/repositories/workflow-repository.js");
      const projectId = uuid();
      const planId = uuid();
      insert("projects", {
        id: projectId,
        name: "Invalid WF Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "generating",
        created_at: now(),
        updated_at: now(),
      });

      mod.createWorkflowRun("wf-invalid-2", planId);
      mod.completeWorkflowRun("wf-invalid-2", "completed");
      expect(() => {
        mod.completeWorkflowRun("wf-invalid-2", "running");
      }).toThrow();
    });
  });

  // ── Transactional integrity ───────────────────────────────────────

  describe("Transactional integrity", () => {
    it("runTransaction commits all writes on success", async () => {
      const { runTransaction } = await import("../../db/sqlite/index.js");
      const id1 = uuid();
      const id2 = uuid();

      runTransaction(() => {
        insert("projects", {
          id: id1,
          name: "Txn 1",
          description: "",
          status: "draft",
          created_at: now(),
          updated_at: now(),
        });
        insert("projects", {
          id: id2,
          name: "Txn 2",
          description: "",
          status: "draft",
          created_at: now(),
          updated_at: now(),
        });
      });

      const res = rawGet("SELECT COUNT(*) as cnt FROM projects WHERE id IN (?, ?)", id1, id2);
      expect(Number(res!.cnt)).toBe(2);
    });

    it("runTransaction rolls back all writes on error", async () => {
      const { runTransaction } = await import("../../db/sqlite/index.js");
      const id1 = uuid();

      try {
        runTransaction(() => {
          insert("projects", {
            id: id1,
            name: "Rollback Test",
            description: "",
            status: "draft",
            created_at: now(),
            updated_at: now(),
          });
          throw new Error("Mid-txn failure");
        });
      } catch {
        // Expected
      }

      const res = rawGet("SELECT * FROM projects WHERE id = ?", id1);
      expect(res).toBeUndefined();
    });
  });

  // ── Validation tests ──────────────────────────────────────────────

  describe("Validation and transition guards", () => {
    it("validateRequiredFields rejects missing fields", async () => {
      const { validateRequiredFields } = await import("../../lib/repositories/validation.js");
      expect(() => {
        validateRequiredFields("Test", { name: "foo" }, ["id", "name", "status"]);
      }).toThrow(/missing required fields/);
    });

    it("validateRequiredFields accepts all present fields", async () => {
      const { validateRequiredFields } = await import("../../lib/repositories/validation.js");
      expect(() => {
        validateRequiredFields("Test", { id: "1", name: "foo", status: "ok" }, ["id", "name", "status"]);
      }).not.toThrow();
    });
  });

  // ── Credential persistence ────────────────────────────────────────

  describe("Provider credential persistence", () => {
    it("saves and loads a credential", () => {
      const credId = uuid();
      insert("provider_credentials", {
        id: credId,
        provider: "mock",
        display_name: "Test Mock",
        status: "valid",
        encrypted_api_key: "test-key",
        created_at: now(),
        updated_at: now(),
      });
      const res = rawGet("SELECT * FROM provider_credentials WHERE id = ?", credId);
      expect(res).toBeDefined();
      expect(res!.provider).toBe("mock");
    });

    it("survives restart", async () => {
      const credId = uuid();
      insert("provider_credentials", {
        id: credId,
        provider: "opencode-go",
        display_name: "Go Key",
        status: "valid",
        encrypted_api_key: "enc:abc",
        created_at: now(),
        updated_at: now(),
      });

      closeDb();
      await initDb();
      createTables();

      const res = rawGet("SELECT * FROM provider_credentials WHERE id = ?", credId);
      expect(res).toBeDefined();
      expect(res!.provider).toBe("opencode-go");
      expect(res!.encrypted_api_key).toBe("enc:abc");
    });
  });

  // ── Activity log persistence ──────────────────────────────────────

  describe("Activity log persistence", () => {
    it("appends audit entries", () => {
      const projectId = uuid();
      const logId = uuid();
      insert("projects", {
        id: projectId,
        name: "Audit Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("activity_log", {
        id: logId,
        project_id: projectId,
        event_type: "generation.completed",
        description: "Blueprint generated",
        created_at: now(),
      });
      const res = rawGet("SELECT * FROM activity_log WHERE id = ?", logId);
      expect(res).toBeDefined();
      expect(res!.event_type).toBe("generation.completed");
    });
  });

  // ── Idempotent writes ─────────────────────────────────────────────

  describe("Idempotent writes", () => {
    it("duplicate graph save is silently ignored", async () => {
      const projectId = uuid();
      const planId = uuid();
      insert("projects", {
        id: projectId,
        name: "Dedup Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "complete",
        created_at: now(),
        updated_at: now(),
      });
      insert("task_graphs", {
        id: uuid(),
        plan_id: planId,
        project_id: projectId,
        plan_version: 1,
        graph_version: 1,
        status: "complete",
        task_count: 3,
        dependency_count: 0,
        created_at: now(),
        updated_at: now(),
      });

      const { createSqliteGraphStore } = await import("../../lib/repositories/graph-repository.js");
      const store = createSqliteGraphStore();
      expect(() => {
        store.saveGraph({ planId, planVersion: 1, tasks: [], dependencies: [] });
      }).not.toThrow();

      const res = rawGet("SELECT COUNT(*) as cnt FROM task_graphs WHERE plan_id = ?", planId);
      expect(Number(res!.cnt)).toBe(1);
    });
  });

  // ── Foreign key enforcement ───────────────────────────────────────

  describe("Foreign key enforcement", () => {
    it("rejects insert with missing parent reference", () => {
      expect(() => {
        insert("interview_sessions", {
          id: uuid(),
          project_id: "nonexistent",
          status: "draft",
          current_phase_index: 0,
          current_question_index: 0,
          created_at: now(),
          updated_at: now(),
        });
      }).toThrow();
    });
  });

  // ── Recovery detection ────────────────────────────────────────────

  describe("Workflow recovery", () => {
    it("detects interrupted workflows on startup", async () => {
      const mod = await import("../../lib/repositories/workflow-repository.js");
      const projectId = uuid();
      const planId = uuid();
      insert("projects", {
        id: projectId,
        name: "Recovery Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "generating",
        created_at: now(),
        updated_at: now(),
      });

      mod.createWorkflowRun("wf-crash-1", planId);
      const interrupted = mod.detectInterruptedWorkflows();
      expect(interrupted.length).toBeGreaterThanOrEqual(1);
      expect(interrupted.some((r) => r.id === "wf-crash-1")).toBe(true);
    });

    it("repairs incomplete steps after detection", async () => {
      const mod = await import("../../lib/repositories/workflow-repository.js");
      const projectId = uuid();
      const planId = uuid();
      insert("projects", {
        id: projectId,
        name: "Repair Project",
        description: "",
        status: "draft",
        created_at: now(),
        updated_at: now(),
      });
      insert("plans", {
        id: planId,
        project_id: projectId,
        version: 1,
        status: "generating",
        created_at: now(),
        updated_at: now(),
      });

      mod.createWorkflowRun("wf-crash-2", planId);
      mod.updateWorkflowStep("wf-crash-2", "synthesis", "completed");

      const before = rawGet(
        "SELECT synthesis_status, analysis_status, status FROM workflow_runs WHERE id = ?",
        "wf-crash-2",
      );
      expect(before!.synthesis_status).toBe("completed");
      expect(before!.analysis_status).toBe("pending");
      expect(before!.status).toBe("running");

      // Now simulate startup recovery
      const steps = ["synthesis", "analysis", "blueprint", "roadmap", "taskGraph", "promptGen", "summary"] as const;
      for (const step of steps) {
        mod.repairIncompleteStep("wf-crash-2", step);
      }

      const after = rawGet(
        "SELECT synthesis_status, analysis_status, status FROM workflow_runs WHERE id = ?",
        "wf-crash-2",
      );
      expect(after!.synthesis_status).toBe("completed"); // unchanged
      expect(after!.analysis_status).toBe("failed"); // was pending, now failed
      expect(after!.status).toBe("failed"); // all steps terminal, so workflow becomes failed
    });
  });
});
