import type { SnapshotRecord, SnapshotStore } from "./types.js";

export function createInMemorySnapshotStore(): SnapshotStore {
  const items: SnapshotRecord[] = [];

  return {
    insert(r) {
      items.push(r);
    },
    get(id) {
      return items.find((r) => r.id === id);
    },
    getByProject(projectId) {
      return items.filter((r) => r.projectId === projectId).sort((a, b) => a.version - b.version);
    },
    getLatestByProject(projectId) {
      const projectSnapshots = items
        .filter((r) => r.projectId === projectId)
        .sort((a, b) => b.version - a.version);
      return projectSnapshots[0];
    },
    updateStatus(id, status, failureReason) {
      const record = items.find((r) => r.id === id);
      if (record) {
        record.status = status;
        record.failureReason = failureReason;
      }
    },
  };
}
