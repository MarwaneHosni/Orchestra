import type { ExportRecord, ExportStore } from "./types.js";

export function createInMemoryExportStore(): ExportStore {
  const byId = new Map<string, ExportRecord>();
  const byProject = new Map<string, ExportRecord[]>();
  const bySnapshot = new Map<string, ExportRecord[]>();

  function getProjectList(projectId: string): ExportRecord[] {
    let list = byProject.get(projectId);
    if (!list) {
      list = [];
      byProject.set(projectId, list);
    }
    return list;
  }

  function getSnapshotList(snapshotId: string): ExportRecord[] {
    let list = bySnapshot.get(snapshotId);
    if (!list) {
      list = [];
      bySnapshot.set(snapshotId, list);
    }
    return list;
  }

  return {
    insert(r) {
      byId.set(r.id, r);
      getProjectList(r.projectId).push(r);
      getSnapshotList(r.snapshotId).push(r);
    },
    get(id) {
      return byId.get(id);
    },
    getByProject(projectId) {
      return [...getProjectList(projectId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    getBySnapshot(snapshotId) {
      return [...getSnapshotList(snapshotId)];
    },
  };
}
