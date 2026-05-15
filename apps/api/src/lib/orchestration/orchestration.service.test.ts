import { describe, expect, it, beforeEach } from "vitest";
import { OrchestrationService } from "./orchestration.service.js";
import { createInMemoryStore } from "./store.js";
import type { SessionStore } from "./store.js";

describe("OrchestrationService", () => {
  let store: SessionStore;
  let orch: OrchestrationService;

  beforeEach(() => {
    store = createInMemoryStore();
    orch = new OrchestrationService(store);
  });

  describe("createProject", () => {
    it("creates a project, idea, and draft session", () => {
      const { projectId, sessionId } = orch.createProject({
        ideaText: "A task management app for remote teams",
      });

      expect(projectId).toBeDefined();
      expect(sessionId).toBeDefined();

      const project = store.getProject(projectId);
      expect(project).toBeDefined();
      expect(project!.name).toContain("task management");

      const session = store.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.status).toBe("draft");
    });

    it("uses custom project name when provided", () => {
      const { projectId } = orch.createProject({
        ideaText: "Some idea",
        projectName: "My Custom Project",
      });
      const project = store.getProject(projectId);
      expect(project!.name).toBe("My Custom Project");
    });
  });

  describe("startSession", () => {
    it("transitions from draft to in_progress", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test idea" });
      const session = orch.startSession(sessionId);
      expect(session.status).toBe("in_progress");
    });

    it("throws for unknown session", () => {
      expect(() => orch.startSession("unknown-id")).toThrow("not found");
    });

    it("is idempotent when already in_progress", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test" });
      orch.startSession(sessionId);
      const session = orch.startSession(sessionId);
      expect(session.status).toBe("in_progress");
    });
  });

  describe("getNextQuestion", () => {
    it("returns the first question for a fresh session", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test idea" });
      orch.startSession(sessionId);
      const result = orch.getNextQuestion(sessionId);

      expect(result.question).not.toBeNull();
      expect((result.question as any).phaseType).toBe("ideation");
      expect((result.question as any).order).toBe(1);
      expect(result.total).toBeGreaterThan(0);
      expect(result.answered).toBe(0);
    });

    it("reports question as null when all answered", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test idea" });
      orch.startSession(sessionId);

      for (let i = 0; i < 100; i++) {
        const result = orch.getNextQuestion(sessionId);
        if (!result.question) break;
        const q = result.question as any;
        orch.submitAnswer(sessionId, q.id, "some answer");
      }

      const final = orch.getNextQuestion(sessionId);
      expect(final.question).toBeNull();
      expect(final.answered).toBe(final.total);
    });
  });

  describe("submitAnswer", () => {
    it("records an answer and advances the session", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test idea" });
      orch.startSession(sessionId);
      const first = orch.getNextQuestion(sessionId);
      const q = first.question as any;

      const { answer } = orch.submitAnswer(sessionId, q.id, "my answer");
      expect(answer.value).toBe("my answer");
      expect(answer.confidence).toBe("high");
      expect(answer.sessionId).toBe(sessionId);

      const saved = store.getAnswersBySession(sessionId);
      expect(saved).toHaveLength(1);
    });

    it("rejects answers on completed sessions", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test" });
      orch.transitionSession(sessionId, "completed");
      expect(() => orch.submitAnswer(sessionId, "any-id", "value")).toThrow("no longer accepting answers");
    });
  });

  describe("transitionSession", () => {
    it("rejects invalid transitions", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test" });
      orch.transitionSession(sessionId, "in_progress");
      expect(() => orch.transitionSession(sessionId, "draft")).toThrow("Cannot transition from");
    });

    it("accepts valid transitions: draft → in_progress", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test" });
      const s = orch.transitionSession(sessionId, "in_progress");
      expect(s.status).toBe("in_progress");
    });

    it("accepts valid transitions: in_progress → ready_for_generation", () => {
      const { sessionId } = orch.createProject({ ideaText: "Test" });
      orch.transitionSession(sessionId, "in_progress");
      const s = orch.transitionSession(sessionId, "ready_for_generation");
      expect(s.status).toBe("ready_for_generation");
    });

    it("throws for unknown session", () => {
      expect(() => orch.transitionSession("bad-id", "completed")).toThrow("not found");
    });
  });
});
