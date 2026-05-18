# Memory Lifecycle Standards

## Bounded Store Rules

Every in-memory data structure must have a maximum size or TTL.

### Required on creation

```
Map<string, T>  →  must have .clear(), .dispose(), or LRU/ring buffer
T[]             →  must have a max length with splice/shift eviction
```

### Acceptable exceptions

- **Function-local variables** — scope-bounded, GC'd on return
- **Cache objects** with explicit TTL-based eviction
- **SQLite-backed stores** — data lives in SQLite, in-memory is only a runtime cache

## Store Ownership

| Store                      | Backed by                 | Eviction                   | Dispose API                 |
| -------------------------- | ------------------------- | -------------------------- | --------------------------- |
| `SessionStore` (in-memory) | SQLite at startup         | N/A (fallback)             | `replaceStore()`            |
| `CredentialStore`          | SQLite at startup         | N/A (fallback)             | `_replaceCredentialStore()` |
| `GraphStore`               | SQLite (shared-stores.ts) | SQLite-persisted           | —                           |
| `PromptStore`              | SQLite (shared-stores.ts) | SQLite-persisted           | —                           |
| `AuditStore`               | In-memory                 | 10k cap with bulk eviction | `dispose()`                 |
| `BudgetStore`              | In-memory                 | 1k LRU eviction            | —                           |
| `RateLimiter`              | In-memory                 | 60s stale-key sweep        | `dispose()`                 |
| `AbuseDetector`            | In-memory                 | 60s stale-key sweep        | `dispose()`                 |
| `MetricsRegistry`          | In-memory                 | 100 samples per metric     | `dispose()`                 |

## Timer/Interval Cleanup

- All `setInterval` calls must use `.unref()` so they don't prevent process exit
- All `setTimeout` calls must clear via `clearTimeout()` in error paths
- Signal handlers (`process.on('SIGTERM')`) are process-lifetime — no removal needed

## Prevention Checklist for PRs

- [ ] No new `Map<string, T>` without eviction/dispose
- [ ] No new `T[]` that grows without a max length
- [ ] No new module-level mutable state without ownership/disposal
- [ ] No orphaned `setInterval`/`setTimeout` that can't be cleared
- [ ] SQLite-backing preferred for long-lived data
