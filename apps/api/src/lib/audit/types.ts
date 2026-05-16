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
  | "budget.warning"
  // Phase 6 — Versioning & Export
  | "snapshot.created"
  | "snapshot.failed"
  | "snapshot.regenerated"
  | "snapshot.partial_regenerated"
  | "export.generated"
  | "export.redownloaded"
  | "export.exported"
  | "compare.viewed"
  | "project.updated"
  // Phase 7 — Guardrails
  | "guardrail.rate_limited"
  | "guardrail.over_budget"
  | "guardrail.circuit_open"
  | "guardrail.abuse_blocked"
  | "retry.attempt"
  | "retry.exhausted"
  | "circuit.state_change";

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  timestamp: string;
  actor: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
}
