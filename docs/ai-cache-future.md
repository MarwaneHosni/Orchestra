# AI Response Cache — Future Scalability & Migration Roadmap

## Current Architecture (SQLite, exact-match)

```
ContentAddressableCache          ← consumer facade (ai-generator.ts, routes)
  └── CacheBackend interface     ← stable contract
        └── SqliteCacheBackend   ← current implementation
```

## Stable Cache Contract

The `CacheBackend` interface (`lib/cache/backend.ts`) is the stable boundary. Any future backend (Redis, hybrid, distributed) must implement:

```typescript
interface CacheBackend {
  lookup(keyInput: CacheKeyInput, keyResult: CacheKeyResult): Promise<CacheEntry | null>;
  store(input: CacheSetInput): Promise<void>;
  invalidateByProvider(provider: string): Promise<number>;
  invalidateByModel(model: string): Promise<number>;
  invalidateAll(): Promise<number>;
  getEntryCount(): Promise<number>;
  isVersionStale(): Promise<boolean>;
  getStats(): Promise<CacheStats>;
  listEntries(limit?: number, offset?: number): Promise<CacheEntry[]>;
  getEntryByKey(cacheKey: string): Promise<CacheEntry | null>;
  getInvalidationMarkers(): Promise<InvalidationMarker[]>;
}
```

### What must remain stable across all backends

| Contract | Rationale |
|---|---|
| **CacheKey semantics** `SHA256(PROMPT_VERSION :: SCHEMA_VERSION :: systemPromptHash :: messagesHash :: model :: provider :: temperature)` | Any backend must derive the same key from the same inputs. The `buildCacheKey()` function in `key-builder.ts` is provider-agnostic and backend-agnostic. |
| **Versioning rules** `promptVersion` and `schemaVersion` in every entry | Staleness detection is backend-independent. A Redis backend must still store and check these fields. |
| **Invalidation contracts** `invalidateByProvider`, `invalidateByModel`, `invalidateAll` | All backends must support at least these three operations. Additional invalidation strategies (by date, by pattern) are backend-specific extensions. |
| **Provenance metadata** `provider`, `model`, `temperature`, `systemPromptHash`, `messagesHash`, `createdAt`, `lastAccessedAt` | The full provenance context must be preserved across backends for auditability and cost accounting. |
| **CacheEntry shape** `{ id, cacheKey, responseContent, responseModel, finishReason, usage, hitCount, createdAt, lastAccessedAt }` | Consumers (ai-generator.ts, routes) depend on this shape. New backends must return entries conforming to this interface. |
| **Exact-match only** No semantic or fuzzy matching at any layer | Semantic caching belongs in a separate middleware layer above the `CacheBackend` interface. The backend only does `key → value` lookups. |

### What is backend-specific

| Feature | SQLite | Redis | Hybrid |
|---|---|---|---|
| Persistence | Durable via `exportDb()` | In-memory + RDB/AOF | SQLite for cold, Redis for hot |
| TTL | Manual purge | `EXPIRE` natively | TTL on hot tier |
| LRU eviction | Manual | `maxmemory-policy allkeys-lru` | Redis LRU + SQLite cold storage |
| Atomicity | Transactions | Lua scripts / MULTI | Depends on coordinator |
| Key scan | `listEntries()` via `SELECT` | `SCAN` cursor | Hybrid scan |
| Hit count | `UPDATE ... SET hit_count = hit_count + 1` | `HINCRBY` | Per-tier tracking |

## Migration Paths

### A. Redis backend (horizontal scaling, multi-process)

Implementation: `RedisCacheBackend implements CacheBackend`

**Changes required:**
1. New file: `lib/cache/redis-backend.ts`
2. Wire in `app.ts`: `globalCache = new ContentAddressableCache(new RedisCacheBackend(redisClient))`
3. All existing consumers unchanged — they talk to `CacheBackend` interface

**Key considerations:**
- SHA256 cache key is already a valid Redis key name (64-char hex)
- `listEntries()` and `getStats()` require full key scan (`SCAN 0 MATCH ai_cache:*`) — may be slow with many entries
- `invalidateByProvider` / `invalidateByModel` need secondary indexes (provider→keys map, model→keys map) or full scan
- Use Redis hash per entry for atomic field updates (hit count, last accessed)
- TTL: set `EXPIRE` on store to support automatic eviction

**Recommended Redis data model:**
```
ai_cache:{cacheKey} → HASH {
  cache_key, prompt_version, schema_version, model, provider,
  temperature, system_prompt_hash, messages_hash, response_content,
  response_model, finish_reason, usage_prompt_tokens,
  usage_completion_tokens, usage_total_tokens, hit_count,
  created_at, last_accessed_at
}
ai_cache:by_provider:{provider} → SET of cacheKey
ai_cache:by_model:{model} → SET of cacheKey
```

### B. Hybrid SQLite + Redis (best performance)

Implementation: `HybridCacheBackend implements CacheBackend`

**Strategy:**
- Write path: write to both SQLite and Redis
- Read path: check Redis first (fast), fall back to SQLite on miss, promote to Redis
- Stats/inspection: read from SQLite (avoid expensive Redis scans)

**Benefits:**
- Sub-millisecond reads for hot data (Redis)
- Durable persistence (SQLite)
- No data loss on Redis restart

### C. Semantic caching layer

Implementation: A new middleware/wrapper that implements `CacheBackend` and adds fuzzy matching on top of an exact-match backend.

**Architecture:**
```
SemanticCacheBackend (implements CacheBackend)
  └── ExactMatchBackend (SqliteCacheBackend or RedisCacheBackend)
```

**How it works:**
1. On lookup, compute exact-match key (current `buildCacheKey`)
2. Check exact-match backend — if hit, return
3. If miss, run similarity search against stored entries using embedding vectors
4. If fuzzy match found and confidence > threshold, return cached result
5. If miss, fall through to provider, then store with embedding vector

**Changes needed:**
- Add `embedding` column to `ai_cache_entries` (FLOAT[] or BLOB)
- Add embedding extraction step in pipeline
- Add vector similarity query (SQLite FTS5 + extensions, or pgvector if on Postgres)
- Define confidence threshold per provider/model

**Constraints:**
- Semantic caching is opt-in per request (configured via `CacheKeyInput.tolerance`)
- Exact-match always takes priority
- Semantic matches must still pass version/schema staleness checks

### D. Workflow-level caching

Caches not just single AI responses but entire multi-step workflows.

**Use case:** The blueprint generation pipeline calls AI once, then generates tasks and prompts deterministically. If the same analysis produces the same blueprint → task graph → prompts, all three can be cached as a single workflow result.

**Implementation:**
- New `WorkflowCache` that wraps `CacheBackend`
- Cache key: `SHA256(analysisHash + planVersion)`
- Cache value: `{ blueprint, roadmap, taskGraph, promptBundle }`
- TTL tied to analysis version

### E. Cache warming / background precomputation

Pre-populate the cache before users trigger generation.

**Use case:** When a user completes their interview answers, precompute the blueprint in the background so the first `POST /generate` returns instantly.

**Implementation:**
- After analysis completes (orchestrator.ts step 2), enqueue a background cache-warm job
- Job calls `provider.generate()` with current inputs and stores result
- When the actual `POST /generate` arrives, cache hit → no provider call
- If cache is already populated, the background job's store is a no-op (idempotent)

## Code Boundaries That Must Stay Provider-Agnostic

| Layer | Currently provider-agnostic? | Must stay? |
|---|---|---|
| `buildCacheKey()` | Yes — uses string `provider` in key but no provider-specific logic | Yes — core invariant |
| `CacheBackend` interface | Yes — no provider types in interface | Yes — clean migration boundary |
| `ContentAddressableCache` facade | Yes — delegates to backend | Yes — consumer stability |
| `SqliteCacheBackend` | Yes — stores provider string but no provider logic | Yes — supports any provider |
| Cache metrics (`instrumentCacheAction` etc.) | Yes — labels include provider but no provider-specific aggregation | Yes — consistent ops |
| `ai-generator.ts` cache wiring | Yes — calls `globalCache.lookup()` with generic `CacheKeyInput` | Yes — provider routing is orthogonal |

## Next-Step Roadmap

### Phase 1 (current): SQLite exact-match ✓
- ContentAddressableCache + SqliteCacheBackend
- 34 tests, 560 total, all passing
- Restart-safe, versioned, observable

### Phase 2 (next): Redis backend
- Implement `RedisCacheBackend`
- Wire via env var: `CACHE_BACKEND=redis` or `CACHE_BACKEND=sqlite`
- 100% test compatibility with existing test suite
- No consumer code changes

### Phase 3: Hybrid backend
- Implement `HybridCacheBackend` (Redis + SQLite)
- Cache warming on write path
- Promote-from-SQLite on read miss

### Phase 4: Semantic caching
- Embedding extraction service (provider-agnostic)
- `SemanticCacheBackend` wrapper
- Confidence-threshold configuration per model
- Separate from exact-match path; both coexist

### Phase 5: Workflow-level caching
- `WorkflowCache` for multi-step pipeline results
- Tied to analysis version
- Reduces total pipeline latency even on cache miss (tasks+prompts are deterministic)

## Migration Without Redesign

The current architecture already supports all five phases without consumer changes:

1. **`ContentAddressableCache`** is the only class imported by consumers (ai-generator.ts, routes)
2. **`CacheBackend`** is the only interface backends must implement
3. **`buildCacheKey()`** is the only key derivation — any backend gets the same key
4. **Versioning, staleness, invalidation** are backend responsibilities with a clear contract

To switch from SQLite to Redis:
```typescript
// app.ts — one line change
import { RedisCacheBackend } from "./lib/cache/redis-backend.js";
globalCache = new ContentAddressableCache(new RedisCacheBackend(redisClient));
```

No changes to ai-generator.ts, routes, or any other consumer.
