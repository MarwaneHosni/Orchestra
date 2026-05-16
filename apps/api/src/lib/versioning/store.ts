import type { SnapshotRecord, SnapshotStore } from "./types.js";

export function createInMemorySnapshotStore(): SnapshotStore {
  const byId = new Map<string, SnapshotRecord>();
  const byProject = new Map<string, SnapshotRecord[]>();

  function getProjectList(projectId: string): SnapshotRecord[] {
    let list = byProject.get(projectId);
    if (!list) {
      list = [];
      byProject.set(projectId, list);
    }
    return list;
  }

  return {
    insert(r) {
      byId.set(r.id, r);
      getProjectList(r.projectId).push(r);
    },
    get(id) {
      return byId.get(id);
    },
    getByProject(projectId) {
      return [...getProjectList(projectId)].sort((a, b) => a.version - b.version);
    },
    getLatestByProject(projectId) {
      const list = getProjectList(projectId);
      if (list.length === 0) return undefined;
      return [...list].sort((a, b) => b.version - a.version)[0];
    },
    updateStatus(id, status, failureReason) {
      const record = byId.get(id);
      if (record) {
        record.status = status;
        record.failureReason = failureReason;
      }
    },
  };
}
