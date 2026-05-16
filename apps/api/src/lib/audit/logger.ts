import type { AuditEntry, AuditEventType } from "./types.js";
import { redactObject } from "./redactor.js";

export interface AuditStore {
  append(entry: AuditEntry): void;
  query(filter?: Partial<AuditEntry>): AuditEntry[];
}

export function createInMemoryAuditStore(): AuditStore {
  const entries: AuditEntry[] = [];
  const byEventType = new Map<string, AuditEntry[]>();

  function getEventList(eventType: string): AuditEntry[] {
    let list = byEventType.get(eventType);
    if (!list) {
      list = [];
      byEventType.set(eventType, list);
    }
    return list;
  }

  return {
    append(e) {
      entries.push(e);
      getEventList(e.eventType).push(e);
    },
    query(filter) {
      if (!filter) return [...entries];
      const { eventType, ...rest } = filter;
      const candidates = eventType ? getEventList(eventType) : entries;
      if (Object.keys(rest).length === 0) return [...candidates];
      return candidates.filter((e) => {
        for (const [key, value] of Object.entries(rest)) {
          if ((e as unknown as Record<string, unknown>)[key] !== value) return false;
        }
        return true;
      });
    },
  };
}

let _store: AuditStore | null = null;

export function getAuditStore(): AuditStore {
  if (!_store) _store = createInMemoryAuditStore();
  return _store;
}

export function createAuditEntry(
  eventType: AuditEventType,
  actor: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    actor,
    resourceId,
    metadata: redactObject(metadata),
  };
}

export function logAudit(
  eventType: AuditEventType,
  actor: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): void {
  const entry = createAuditEntry(eventType, actor, resourceId, metadata);
  getAuditStore().append(entry);
  console.log(JSON.stringify({ _audit: true, ...entry }));
}
