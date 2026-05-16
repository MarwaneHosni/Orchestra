import type { ExportRecord, ExportStore } from "./types.js";

export function createInMemoryExportStore(): ExportStore {
  const items: ExportRecord[] = [];

  return {
    insert(r) {
      items.push(r);
    },
    get(id) {
      return items.find((e) => e.id === id);
    },
    getByProject(projectId) {
      return items
        .filter((e) => e.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    getBySnapshot(snapshotId) {
      return items.filter((e) => e.snapshotId === snapshotId);
    },
  };
}
