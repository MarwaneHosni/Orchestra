import type {
  AnswerSnapshot,
  AnswerStore,
  ArtifactRecord,
  ArtifactStore,
  GenerationRunRecord,
  GenerationRunStore,
} from "./types.js";

// ── Answer Store ──────────────────────────────────────────────

export function createInMemoryAnswerStore(): AnswerStore {
  const snapshots = new Map<string, AnswerSnapshot>();
  const bySession = new Map<string, AnswerSnapshot[]>();
  const byProject = new Map<string, AnswerSnapshot[]>();

  function getSessionList(sessionId: string): AnswerSnapshot[] {
    let list = bySession.get(sessionId);
    if (!list) {
      list = [];
      bySession.set(sessionId, list);
    }
    return list;
  }

  function getProjectList(projectId: string): AnswerSnapshot[] {
    let list = byProject.get(projectId);
    if (!list) {
      list = [];
      byProject.set(projectId, list);
    }
    return list;
  }

  return {
    captureSnapshot(projectId, sessionId, answers) {
      const existing = getProjectList(projectId);
      const version = existing.length + 1;
      const snapshot: AnswerSnapshot = {
        snapshotId: crypto.randomUUID(),
        projectId,
        sessionId,
        answers,
        capturedAt: new Date().toISOString(),
        answerCount: answers.length,
        version,
      };
      snapshots.set(snapshot.snapshotId, snapshot);
      getSessionList(sessionId).push(snapshot);
      getProjectList(projectId).push(snapshot);
      return snapshot;
    },
    getSnapshot(id) {
      return snapshots.get(id);
    },
    getSnapshotsBySession(sessionId) {
      return [...getSessionList(sessionId)];
    },
    getLatestAnswerVersion(projectId) {
      const list = getProjectList(projectId);
      return list.length > 0 ? list[list.length - 1] : undefined;
    },
  };
}

// ── Artifact Store ────────────────────────────────────────────

export function createInMemoryArtifactStore(): ArtifactStore {
  const byId = new Map<string, ArtifactRecord>();
  const byProject = new Map<string, ArtifactRecord[]>();

  function getProjectList(projectId: string): ArtifactRecord[] {
    let list = byProject.get(projectId);
    if (!list) {
      list = [];
      byProject.set(projectId, list);
    }
    return list;
  }

  return {
    save(r) {
      byId.set(r.id, r);
      getProjectList(r.projectId).push(r);
    },
    get(id) {
      return byId.get(id);
    },
    getByProject(projectId) {
      return [...getProjectList(projectId)];
    },
    getByTypeAndVersion(projectId, type, version) {
      return getProjectList(projectId).find((r) => r.type === type && r.version === version);
    },
    getAllVersions(projectId, type) {
      return getProjectList(projectId)
        .filter((r) => r.type === type)
        .sort((a, b) => a.version - b.version);
    },
  };
}

// ── Generation Run Store ─────────────────────────────────────

export function createInMemoryGenerationRunStore(): GenerationRunStore {
  const byId = new Map<string, GenerationRunRecord>();
  const byProject = new Map<string, GenerationRunRecord[]>();

  function getProjectList(projectId: string): GenerationRunRecord[] {
    let list = byProject.get(projectId);
    if (!list) {
      list = [];
      byProject.set(projectId, list);
    }
    return list;
  }

  return {
    save(r) {
      byId.set(r.id, r);
      getProjectList(r.projectId).push(r);
    },
    get(id) {
      return byId.get(id);
    },
    getByProject(projectId) {
      return [...getProjectList(projectId)];
    },
  };
}
