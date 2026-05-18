import type { AuditEntry, AuditEventType } from "./types.js";
import { redactObject } from "./redactor.js";

const MAX_AUDIT_ENTRIES = 10_000;

export interface AuditStore {
  append(entry: AuditEntry): void;
  query(filter?: Partial<AuditEntry>): AuditEntry[];
  dispose(): void;
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

  function evictOldest(): void {
    if (entries.length <= MAX_AUDIT_ENTRIES) return;
    const toRemove = entries.length - MAX_AUDIT_ENTRIES;
    const removed = entries.splice(0, toRemove);
    // Also remove from byEventType indexes
    const removedIds = new Set(removed.map((r) => r.id));
    for (const [, list] of byEventType) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (removedIds.has(list[i]!.id)) list.splice(i, 1);
      }
    }
  }

  return {
    append(e) {
      entries.push(e);
      getEventList(e.eventType).push(e);
      if (entries.length > MAX_AUDIT_ENTRIES * 1.5) evictOldest();
    },
    query(filter) {
      if (entries.length > MAX_AUDIT_ENTRIES) evictOldest();
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
    dispose() {
      entries.length = 0;
      byEventType.clear();
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
