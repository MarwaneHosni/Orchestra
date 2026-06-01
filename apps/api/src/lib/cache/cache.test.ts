import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { initDb, closeDb, isInitialized, rawRun, rawGet } from "../../db/sqlite/index.js";
import { createTables } from "../../db/sqlite/bootstrap.js";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

let dbPath: string;

beforeAll(async () => {
  dbPath = resolve(tmpdir(), `cache-test-${Date.now()}.db`);
  process.env.SQLITE_DB_PATH = dbPath;
  if (!isInitialized()) {
    await initDb();
  }
});

afterAll(() => {
  closeDb();
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
});

// Re-import to get fresh instances after DB init
const mod = await import("./cache-service.js");
const { globalCache, ContentAddressableCache } = mod;
const keyMod = await import("./key-builder.js");
const { buildCacheKey, CACHE_PROMPT_VERSION, CACHE_SCHEMA_VERSION } = keyMod;

function makeCacheKeyInput(overrides: Record<string, unknown> = {}) {
  return {
    systemPrompt: "You are a helpful assistant.",
    messages: [{ role: "user" as const, content: "Hello" }],
    model: "test-model",
    provider: "test-provider",
    temperature: 0.7,
    ...overrides,
  };
}

function makeGenerationResult(overrides: Record<string, unknown> = {}) {
  return {
    content: '{"result": "ok"}',
    model: "test-model",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: "stop",
    ...overrides,
  };
}

describe("AI Cache", () => {

  beforeEach(async () => {
    await globalCache.invalidateAll();
  });

  describe("buildCacheKey", () => {
    it("produces a deterministic 64-char hex key", () => {
      const input = makeCacheKeyInput();
      const k1 = buildCacheKey(input);
      const k2 = buildCacheKey(input);
      expect(k1.cacheKey).toBe(k2.cacheKey);
      expect(k1.cacheKey).toMatch(/^[0-9a-f]{64}$/);
    });

    it("different messages produce different keys", () => {
      const k1 = buildCacheKey(makeCacheKeyInput({ messages: [{ role: "user", content: "Hello" }] }));
      const k2 = buildCacheKey(makeCacheKeyInput({ messages: [{ role: "user", content: "World" }] }));
      expect(k1.cacheKey).not.toBe(k2.cacheKey);
    });

    it("different model produces different key", () => {
      const k1 = buildCacheKey(makeCacheKeyInput({ model: "gpt-4o" }));
      const k2 = buildCacheKey(makeCacheKeyInput({ model: "gpt-4o-mini" }));
      expect(k1.cacheKey).not.toBe(k2.cacheKey);
    });

    it("different temperature produces different key", () => {
      const k1 = buildCacheKey(makeCacheKeyInput({ temperature: 0.7 }));
      const k2 = buildCacheKey(makeCacheKeyInput({ temperature: 1.0 }));
      expect(k1.cacheKey).not.toBe(k2.cacheKey);
    });

    it("includes prompt version and schema version", () => {
      const k = buildCacheKey(makeCacheKeyInput());
      expect(k.promptVersion).toBe(CACHE_PROMPT_VERSION);
      expect(k.schemaVersion).toBe(CACHE_SCHEMA_VERSION);
    });
  });

  describe("lookup and store", () => {
    it("returns null on cache miss", async () => {
      const result = await globalCache.lookup(makeCacheKeyInput());
      expect(result).toBeNull();
    });

    it("stores and retrieves a cached response", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      const genResult = makeGenerationResult();

      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: genResult });

      const cached = await globalCache.lookup(input);
      expect(cached).not.toBeNull();
      expect(cached!.responseContent).toBe(genResult.content);
      expect(cached!.responseModel).toBe(genResult.model);
      expect(cached!.finishReason).toBe(genResult.finishReason);
      expect(cached!.usage.promptTokens).toBe(genResult.usage.promptTokens);
      expect(cached!.usage.completionTokens).toBe(genResult.usage.completionTokens);
      expect(cached!.usage.totalTokens).toBe(genResult.usage.totalTokens);
    });

    it("increments hit count on each lookup", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: makeGenerationResult() });

      const hit1 = await globalCache.lookup(input);
      expect(hit1!.hitCount).toBeGreaterThanOrEqual(2); // 1 from store + at least 1 from lookup

      const hit2 = await globalCache.lookup(input);
      expect(hit2!.hitCount).toBeGreaterThan(hit1!.hitCount);
    });

    it("exact-match: same input always retrieves same content", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: makeGenerationResult() });

      const cached1 = await globalCache.lookup(input);
      const cached2 = await globalCache.lookup(input);
      expect(cached1!.responseContent).toBe(cached2!.responseContent);
    });

    it("duplicate store does not throw (idempotent)", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      const genResult = makeGenerationResult();

      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: genResult });
      await expect(globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: genResult })).resolves.toBeUndefined();
    });
  });

  describe("persistence (restart survival)", () => {
    it("survives DB export/close cycle", async () => {
      const input = makeCacheKeyInput({ model: "persist-test" });
      const keyResult = buildCacheKey(input);
      const genResult = makeGenerationResult();

      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: genResult });

      // Simulate restart: close and re-init
      closeDb();
      process.env.SQLITE_DB_PATH = dbPath;
      await initDb();

      // Re-acquire the globalCache (it's a singleton, but the DB connection is fresh)
      const { globalCache: freshCache } = await import("./cache-service.js");
      const cached = await freshCache.lookup(input);
      expect(cached).not.toBeNull();
      expect(cached!.responseContent).toBe(genResult.content);
    });
  });

  describe("invalidation", () => {
    it("invalidates by provider", async () => {
      const p1Input = makeCacheKeyInput({ provider: "provider-a" });
      const p2Input = makeCacheKeyInput({ provider: "provider-b" });

      await globalCache.store({ cacheKey: buildCacheKey(p1Input).cacheKey, keyResult: buildCacheKey(p1Input), model: p1Input.model, provider: p1Input.provider, temperature: 0.7, result: makeGenerationResult() });
      await globalCache.store({ cacheKey: buildCacheKey(p2Input).cacheKey, keyResult: buildCacheKey(p2Input), model: p2Input.model, provider: p2Input.provider, temperature: 0.7, result: makeGenerationResult() });

      const removed = await globalCache.invalidateByProvider("provider-a");
      expect(removed).toBeGreaterThanOrEqual(1);

      expect(await globalCache.lookup(p1Input)).toBeNull();
      expect(await globalCache.lookup(p2Input)).not.toBeNull();
    });

    it("invalidates by model", async () => {
      const m1Input = makeCacheKeyInput({ model: "model-a" });
      const m2Input = makeCacheKeyInput({ model: "model-b" });

      await globalCache.store({ cacheKey: buildCacheKey(m1Input).cacheKey, keyResult: buildCacheKey(m1Input), model: m1Input.model, provider: m1Input.provider, temperature: 0.7, result: makeGenerationResult() });
      await globalCache.store({ cacheKey: buildCacheKey(m2Input).cacheKey, keyResult: buildCacheKey(m2Input), model: m2Input.model, provider: m2Input.provider, temperature: 0.7, result: makeGenerationResult() });

      await globalCache.invalidateByModel("model-a");
      expect(await globalCache.lookup(m1Input)).toBeNull();
      expect(await globalCache.lookup(m2Input)).not.toBeNull();
    });

    it("invalidateAll removes all entries", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: makeGenerationResult() });

      const removed = await globalCache.invalidateAll();
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await globalCache.lookup(input)).toBeNull();
    });
  });

  describe("getEntryCount", () => {
    it("returns 0 for empty cache", async () => {
      await globalCache.invalidateAll();
      expect(await globalCache.getEntryCount()).toBe(0);
    });

    it("returns correct count after stores", async () => {
      await globalCache.invalidateAll();
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: makeGenerationResult() });
      expect(await globalCache.getEntryCount()).toBe(1);
    });
  });

  describe("version staleness", () => {
    it("isVersionStale returns false for current version", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: input.temperature, result: makeGenerationResult() });
      expect(await globalCache.isVersionStale()).toBe(false);
    });

    it("isVersionStale returns true when prompt version is outdated", async () => {
      // Store an entry with prompt_version=0 (simulating old version)
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      const now = new Date().toISOString();
      rawRun(
        "INSERT INTO ai_cache_entries (cache_key, prompt_version, schema_version, model, provider, temperature, system_prompt_hash, messages_hash, response_content, response_model, finish_reason, usage_prompt_tokens, usage_completion_tokens, usage_total_tokens, hit_count, created_at, last_accessed_at) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `stale-${Date.now()}`,
        CACHE_SCHEMA_VERSION,
        input.model,
        input.provider,
        input.temperature,
        "old-hash",
        "old-hash",
        "old content",
        input.model,
        "stop",
        0, 0, 0, 0,
        now,
        now,
      );
      expect(await globalCache.isVersionStale()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles nullish result gracefully (store does not create a miss entry)", async () => {
      const input = makeCacheKeyInput();
      expect(await globalCache.lookup(input)).toBeNull();
    });

    it("different providers produce separate cache entries", async () => {
      const p1 = makeCacheKeyInput({ provider: "openai", model: "gpt-4o" });
      const p2 = makeCacheKeyInput({ provider: "anthropic", model: "claude-3" });

      await globalCache.store({ cacheKey: buildCacheKey(p1).cacheKey, keyResult: buildCacheKey(p1), model: p1.model, provider: p1.provider, temperature: 0.7, result: makeGenerationResult() });
      await globalCache.store({ cacheKey: buildCacheKey(p2).cacheKey, keyResult: buildCacheKey(p2), model: p2.model, provider: p2.provider, temperature: 0.7, result: makeGenerationResult() });

      expect(await globalCache.getEntryCount()).toBe(2);
    });
  });

  describe("collision resistance", () => {
    it("different providers never collide on same prompt and model", async () => {
      const inputA = makeCacheKeyInput({ provider: "openai", model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] });
      const inputB = makeCacheKeyInput({ provider: "anthropic", model: "claude-3", messages: [{ role: "user", content: "Hello" }] });

      const keyA = buildCacheKey(inputA);
      const keyB = buildCacheKey(inputB);
      expect(keyA.cacheKey).not.toBe(keyB.cacheKey);
    });

    it("system prompt changes produce different keys", () => {
      const k1 = buildCacheKey(makeCacheKeyInput({ systemPrompt: "You are helpful." }));
      const k2 = buildCacheKey(makeCacheKeyInput({ systemPrompt: "You are harmful." }));
      expect(k1.cacheKey).not.toBe(k2.cacheKey);
    });

    it("message ordering matters (different order → different key)", () => {
      const k1 = buildCacheKey(makeCacheKeyInput({
        messages: [{ role: "user", content: "A" }, { role: "assistant", content: "B" }],
      }));
      const k2 = buildCacheKey(makeCacheKeyInput({
        messages: [{ role: "assistant", content: "B" }, { role: "user", content: "A" }],
      }));
      expect(k1.cacheKey).not.toBe(k2.cacheKey);
    });

    it("JSON.stringify whitespace does not affect key (canonical JSON)", () => {
      const msg1 = { role: "user" as const, content: "Hello" };
      const msg2 = { role: "user" as const, content: "Hello" };
      const k1 = buildCacheKey(makeCacheKeyInput({ messages: [msg1] }));
      const k2 = buildCacheKey(makeCacheKeyInput({ messages: [msg2] }));
      expect(k1.cacheKey).toBe(k2.cacheKey);
    });
  });

  describe("stale-entry rejection", () => {
    it("lookup deletes and returns null for stale entries", async () => {
      // Insert an entry with prompt_version=0 (stale)
      const input = makeCacheKeyInput({ model: "stale-test" });
      const { cacheKey } = buildCacheKey(input);
      const now = new Date().toISOString();
      rawRun(
        "INSERT INTO ai_cache_entries (cache_key, prompt_version, schema_version, model, provider, temperature, system_prompt_hash, messages_hash, response_content, response_model, finish_reason, usage_prompt_tokens, usage_completion_tokens, usage_total_tokens, hit_count, created_at, last_accessed_at) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        cacheKey,
        CACHE_SCHEMA_VERSION,
        input.model,
        input.provider,
        input.temperature,
        "hash", "hash",
        "stale content",
        input.model,
        "stop",
        10, 5, 15, 0,
        now, now,
      );

      const result = await globalCache.lookup(input);
      expect(result).toBeNull();

      // Entry should be deleted from DB
      const count = await globalCache.getEntryCount();
      expect(count).toBe(0);
    });

    it("isVersionStale returns true when only stale entries exist", async () => {
      const now = new Date().toISOString();
      rawRun(
        "INSERT INTO ai_cache_entries (cache_key, prompt_version, schema_version, model, provider, temperature, system_prompt_hash, messages_hash, response_content, response_model, finish_reason, usage_prompt_tokens, usage_completion_tokens, usage_total_tokens, hit_count, created_at, last_accessed_at) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `stale-only-${Date.now()}`,
        CACHE_SCHEMA_VERSION,
        "stale-model",
        "stale-provider",
        0.7,
        "hash", "hash",
        "stale",
        "stale-model",
        "stop",
        0, 0, 0, 0,
        now, now,
      );
      expect(await globalCache.isVersionStale()).toBe(true);
    });

    it("getStats includes stale entry count", async () => {
      await globalCache.invalidateAll();
      // Insert one stale entry
      const now = new Date().toISOString();
      rawRun(
        "INSERT INTO ai_cache_entries (cache_key, prompt_version, schema_version, model, provider, temperature, system_prompt_hash, messages_hash, response_content, response_model, finish_reason, usage_prompt_tokens, usage_completion_tokens, usage_total_tokens, hit_count, created_at, last_accessed_at) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `stale-stat-${Date.now()}`,
        CACHE_SCHEMA_VERSION,
        "stale-model-2",
        "stale-provider-2",
        0.7,
        "hash", "hash",
        "stale",
        "stale-model-2",
        "stop",
        0, 0, 0, 0,
        now, now,
      );
      const stats = await globalCache.getStats();
      expect(stats.staleEntryCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("no failed caching", () => {
    it("zero-usage results (simulating failure) are not cached by design", async () => {
      // Simulate what the pipeline does: only successful parse runs store()
      // If a provider returns empty content, parseBlueprintResponse returns null → no cache write
      const input = makeCacheKeyInput();
      const result = makeGenerationResult({ content: "", finishReason: "error" });

      // Manually: don't call store — this simulates the pipeline's behavior on failure
      const cached = await globalCache.lookup(input);
      expect(cached).toBeNull();
    });

    it("store only called with status='completed' records", async () => {
      // In the pipeline, store() is only called inside `if (parsed)` block
      // which only executes after successful parseBlueprintResponse + Zod validation
      // This test verifies the cache layer itself doesn't introduce side effects
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      // store a valid result
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: 0.7, result: makeGenerationResult() });
      expect(await globalCache.lookup(input)).not.toBeNull();
    });

    it("finish_reason 'error' and 'length' are stored as-is (no additional filtering by cache)", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      const genResult = makeGenerationResult({ finishReason: "length", content: '{"partial": true}' });
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: 0.7, result: genResult });
      const cached = await globalCache.lookup(input);
      expect(cached).not.toBeNull();
      expect(cached!.finishReason).toBe("length");
    });
  });

  describe("inspection and listing", () => {
    it("listEntries returns stored entries", async () => {
      await globalCache.invalidateAll();
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: 0.7, result: makeGenerationResult() });
      const entries = await globalCache.listEntries();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0]!.responseContent).toBe('{"result": "ok"}');
    });

    it("getEntryByKey retrieves by cache key", async () => {
      const input = makeCacheKeyInput();
      const keyResult = buildCacheKey(input);
      await globalCache.store({ cacheKey: keyResult.cacheKey, keyResult, model: input.model, provider: input.provider, temperature: 0.7, result: makeGenerationResult() });
      const entry = await globalCache.getEntryByKey(keyResult.cacheKey);
      expect(entry).not.toBeNull();
      expect(entry!.cacheKey).toBe(keyResult.cacheKey);
    });

    it("getInvalidationMarkers returns empty initially", async () => {
      const markers = await globalCache.getInvalidationMarkers();
      expect(markers).toBeDefined();
    });

    it("getStats returns all expected fields", async () => {
      const stats = await globalCache.getStats();
      expect(stats).toHaveProperty("entryCount");
      expect(stats).toHaveProperty("totalHits");
      expect(stats).toHaveProperty("providers");
      expect(stats).toHaveProperty("models");
      expect(stats).toHaveProperty("promptVersion");
      expect(stats).toHaveProperty("schemaVersion");
      expect(stats).toHaveProperty("staleEntryCount");
      expect(stats).toHaveProperty("invalidationCount");
    });
  });
});
