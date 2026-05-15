import type {
  ProjectRecord,
  IdeaRecord,
  SessionRecord,
  AnswerRecord,
  PlanRecord,
  BlueprintRecord,
} from "./types.js";

export interface SessionStore {
  insertProject(p: ProjectRecord): void;
  getProject(id: string): ProjectRecord | undefined;
  insertIdea(i: IdeaRecord): void;
  insertSession(s: SessionRecord): void;
  updateSession(id: string, s: Partial<SessionRecord>): void;
  getSession(id: string): SessionRecord | undefined;
  getSessionsByProject(projectId: string): SessionRecord[];
  insertAnswer(a: AnswerRecord): void;
  getAnswersBySession(sessionId: string): AnswerRecord[];
  insertPlan(p: PlanRecord): void;
  getPlansByProject(projectId: string): PlanRecord[];
  insertBlueprint(b: BlueprintRecord): void;
  getBlueprintsByProject(projectId: string): BlueprintRecord[];
}

export function createInMemoryStore(): SessionStore {
  const p: ProjectRecord[] = [];
  const i: IdeaRecord[] = [];
  const s: SessionRecord[] = [];
  const a: AnswerRecord[] = [];
  const plans: PlanRecord[] = [];
  const blueprints: BlueprintRecord[] = [];

  return {
    insertProject(r) {
      p.push(r);
    },
    getProject(id) {
      return p.find((r) => r.id === id);
    },
    insertIdea(r) {
      i.push(r);
    },
    insertSession(r) {
      s.push(r);
    },
    updateSession(id, partial) {
      const idx = s.findIndex((r) => r.id === id);
      if (idx !== -1) {
        const existing = s[idx];
        if (existing) Object.assign(existing, partial);
      }
    },
    getSession(id) {
      return s.find((r) => r.id === id);
    },
    getSessionsByProject(projectId) {
      return s.filter((r) => r.projectId === projectId);
    },
    insertAnswer(r) {
      a.push(r);
    },
    getAnswersBySession(sessionId) {
      return a.filter((r) => r.sessionId === sessionId);
    },
    insertPlan(r) {
      plans.push(r);
    },
    getPlansByProject(projectId) {
      return plans.filter((r) => r.projectId === projectId);
    },
    insertBlueprint(r) {
      blueprints.push(r);
    },
    getBlueprintsByProject(projectId) {
      return blueprints.filter((r) => r.projectId === projectId);
    },
  };
}

let _store: SessionStore | null = null;

export function getStore(): SessionStore {
  if (!_store) _store = createInMemoryStore();
  return _store;
}
