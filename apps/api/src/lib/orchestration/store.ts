import type { ProjectRecord, IdeaRecord, SessionRecord, AnswerRecord } from "./types.js";

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
}

export function createInMemoryStore(): SessionStore {
  const p: ProjectRecord[] = [];
  const i: IdeaRecord[] = [];
  const s: SessionRecord[] = [];
  const a: AnswerRecord[] = [];

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
  };
}

let _store: SessionStore | null = null;

export function getStore(): SessionStore {
  if (!_store) _store = createInMemoryStore();
  return _store;
}
