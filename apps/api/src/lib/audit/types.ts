export type AuditEventType =
  | "credential.created"
  | "credential.validated"
  | "credential.updated"
  | "credential.deleted"
  | "routing.selected"
  | "generation.attempted"
  | "generation.completed"
  | "generation.failed"
  | "budget.blocked"
  | "budget.warning";

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  timestamp: string;
  actor: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
}
