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
  getAllProjects(): ProjectRecord[];
  insertIdea(i: IdeaRecord): void;
  insertSession(s: SessionRecord): void;
  updateSession(id: string, s: Partial<SessionRecord>): void;
  getSession(id: string): SessionRecord | undefined;
  getSessionsByProject(projectId: string): SessionRecord[];
  insertAnswer(a: AnswerRecord): void;
  getAnswersBySession(sessionId: string): AnswerRecord[];
  getLatestAnswersBySession(sessionId: string): AnswerRecord[];
  supersedeAnswer(sessionId: string, questionId: string): void;
  insertPlan(p: PlanRecord): void;
  getPlansByProject(projectId: string): PlanRecord[];
  markPlansStaleBySession(sessionId: string): void;
  insertBlueprint(b: BlueprintRecord): void;
  getBlueprintsByProject(projectId: string): BlueprintRecord[];
  markBlueprintsStaleBySession(sessionId: string): void;
  deleteProject(id: string): void;
}

export function createInMemoryStore(): SessionStore {
  const projects = new Map<string, ProjectRecord>();
  const ideas: IdeaRecord[] = [];
  const sessions = new Map<string, SessionRecord>();
  const sessionsByProject = new Map<string, SessionRecord[]>();
  const answersBySession = new Map<string, AnswerRecord[]>();
  const latestAnswersBySession = new Map<string, AnswerRecord[]>();
  const plansByProject = new Map<string, PlanRecord[]>();
  const blueprintsByProject = new Map<string, BlueprintRecord[]>();

  function invalidateAnswerCache(sessionId: string): void {
    latestAnswersBySession.delete(sessionId);
  }

  function getProjectSessions(projectId: string): SessionRecord[] {
    let list = sessionsByProject.get(projectId);
    if (!list) {
      list = [];
      sessionsByProject.set(projectId, list);
    }
    return list;
  }

  function getProjectPlans(projectId: string): PlanRecord[] {
    let list = plansByProject.get(projectId);
    if (!list) {
      list = [];
      plansByProject.set(projectId, list);
    }
    return list;
  }

  function getProjectBlueprints(projectId: string): BlueprintRecord[] {
    let list = blueprintsByProject.get(projectId);
    if (!list) {
      list = [];
      blueprintsByProject.set(projectId, list);
    }
    return list;
  }

  return {
    insertProject(r) {
      projects.set(r.id, r);
    },
    getProject(id) {
      return projects.get(id);
    },
    getAllProjects() {
      return [...projects.values()];
    },
    insertIdea(r) {
      ideas.push(r);
    },
    insertSession(r) {
      sessions.set(r.id, r);
      getProjectSessions(r.projectId).push(r);
    },
    updateSession(id, partial) {
      const existing = sessions.get(id);
      if (existing) Object.assign(existing, partial);
    },
    getSession(id) {
      return sessions.get(id);
    },
    getSessionsByProject(projectId) {
      return [...getProjectSessions(projectId)];
    },
    insertAnswer(r) {
      let list = answersBySession.get(r.sessionId);
      if (!list) {
        list = [];
        answersBySession.set(r.sessionId, list);
      }
      list.push(r);
      invalidateAnswerCache(r.sessionId);
    },
    getAnswersBySession(sessionId) {
      return [...(answersBySession.get(sessionId) ?? [])];
    },
    getLatestAnswersBySession(sessionId) {
      const cached = latestAnswersBySession.get(sessionId);
      if (cached) return cached;
      const all = answersBySession.get(sessionId);
      if (!all) return [];
      const latest = all.filter((r) => r.isLatest);
      latestAnswersBySession.set(sessionId, latest);
      return latest;
    },
    supersedeAnswer(sessionId, questionId) {
      const list = answersBySession.get(sessionId);
      if (!list) return;
      const now = new Date().toISOString();
      for (const ans of list) {
        if (ans.questionId === questionId && ans.isLatest) {
          ans.isLatest = false;
          ans.supersededAt = now;
        }
      }
      invalidateAnswerCache(sessionId);
    },
    insertPlan(r) {
      getProjectPlans(r.projectId).push(r);
    },
    getPlansByProject(projectId) {
      return [...getProjectPlans(projectId)];
    },
    markPlansStaleBySession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return;
      const now = new Date().toISOString();
      const list = getProjectPlans(session.projectId);
      for (const plan of list) {
        if (!plan.staleAt) plan.staleAt = now;
      }
    },
    insertBlueprint(r) {
      getProjectBlueprints(r.projectId).push(r);
    },
    getBlueprintsByProject(projectId) {
      return [...getProjectBlueprints(projectId)];
    },
    markBlueprintsStaleBySession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return;
      const now = new Date().toISOString();
      const list = getProjectBlueprints(session.projectId);
      for (const bp of list) {
        if (!bp.staleAt) bp.staleAt = now;
      }
    },
    deleteProject(_id: string) {
      // No-op for in-memory store — only the SQLite store is used in production.
    },
  };
}

let _store: SessionStore | null = null;

export function getStore(): SessionStore {
  if (!_store) _store = createInMemoryStore();
  return _store;
}

export function replaceStore(store: SessionStore): void {
  _store = store;
}
