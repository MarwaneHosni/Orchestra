import { logAudit, getAuditStore } from "../audit/logger.js";
import type { AuditEventType } from "../audit/types.js";

export class AnalyticsService {
  constructor() {}

  trackSnapshotCreated(
    projectId: string,
    snapshotId: string,
    version: number,
    reason: string,
    isPartial: boolean,
  ) {
    this.emit(isPartial ? "snapshot.partial_regenerated" : "snapshot.created", projectId, snapshotId, {
      version,
      reason,
      isPartial,
    });
  }

  trackSnapshotFailed(projectId: string, snapshotId: string, reason: string) {
    this.emit("snapshot.failed", projectId, snapshotId, { reason });
  }

  trackExportGenerated(
    projectId: string,
    exportId: string,
    snapshotId: string,
    format: string,
    type: string,
  ) {
    this.emit("export.generated", projectId, exportId, { snapshotId, format, type });
  }

  trackExportRedownloaded(projectId: string, exportId: string) {
    this.emit("export.redownloaded", projectId, exportId, {});
  }

  trackCompareViewed(projectId: string, leftSnapshotId: string, rightSnapshotId: string) {
    this.emit("compare.viewed", projectId, null, { leftSnapshotId, rightSnapshotId });
  }

  getActivityForProject(projectId: string) {
    return getAuditStore()
      .query({ resourceId: projectId })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 100);
  }

  getProjectSummary(projectId: string) {
    const events = getAuditStore().query({ resourceId: projectId });
    return {
      totalEvents: events.length,
      snapshotCount: events.filter(
        (e) => e.eventType === "snapshot.created" || e.eventType === "snapshot.partial_regenerated",
      ).length,
      exportCount: events.filter((e) => e.eventType === "export.generated").length,
      compareCount: events.filter((e) => e.eventType === "compare.viewed").length,
      failedCount: events.filter((e) => e.eventType === "snapshot.failed").length,
    };
  }

  private emit(
    eventType: AuditEventType,
    projectId: string,
    resourceId: string | null,
    metadata: Record<string, unknown>,
  ) {
    logAudit(eventType, "system", resourceId ?? projectId, {
      ...metadata,
      projectId,
    });
  }
}
