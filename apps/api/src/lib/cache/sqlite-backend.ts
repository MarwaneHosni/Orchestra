import { getDb } from "../../db/sqlite/index.js";
import { aiCacheEntries, aiCacheInvalidationMarkers } from "../../db/sqlite/schema/ai-cache.js";
import { eq, sql } from "drizzle-orm";
import { CACHE_PROMPT_VERSION, CACHE_SCHEMA_VERSION } from "./key-builder.js";
import type { CacheKeyInput, CacheKeyResult } from "./key-builder.js";
import type { CacheBackend, CacheEntry, CacheSetInput } from "./backend.js";
import { instrumentCacheAction, instrumentCacheLatency, instrumentCacheCostSavings, instrumentCacheStaleEntry } from "../metrics/index.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("cache");

export class SqliteCacheBackend implements CacheBackend {
  async lookup(keyInput: CacheKeyInput, keyResult: CacheKeyResult): Promise<CacheEntry | null> {
    const start = Date.now();

    try {
      const db = getDb();
      const row = await db
        .select()
        .from(aiCacheEntries)
        .where(eq(aiCacheEntries.cacheKey, keyResult.cacheKey))
        .limit(1);

      instrumentCacheLatency("lookup", keyInput.provider, Date.now() - start);

      if (row.length === 0) {
        instrumentCacheAction("miss", keyInput.provider);
        return null;
      }

      instrumentCacheAction("hit", keyInput.provider);
      const entry = row[0]!;

      if (entry.promptVersion < CACHE_PROMPT_VERSION) {
        instrumentCacheStaleEntry(keyInput.provider);
        await db.delete(aiCacheEntries).where(eq(aiCacheEntries.cacheKey, keyResult.cacheKey));
        return null;
      }

      const tokensSaved = entry.usageTotalTokens;
      const costSaved = tokensSaved > 0
        ? (entry.usagePromptTokens / 1000) * 0.002 + (entry.usageCompletionTokens / 1000) * 0.008
        : 0;
      instrumentCacheCostSavings(keyInput.provider, tokensSaved, Math.round(costSaved * 1_000_000) / 1_000_000);

      await db
        .update(aiCacheEntries)
        .set({
          hitCount: entry.hitCount + 1,
          lastAccessedAt: new Date().toISOString(),
        })
        .where(eq(aiCacheEntries.cacheKey, keyResult.cacheKey));

      return {
        id: entry.id,
        cacheKey: entry.cacheKey,
        responseContent: entry.responseContent,
        responseModel: entry.responseModel,
        finishReason: entry.finishReason,
        usage: {
          promptTokens: entry.usagePromptTokens,
          completionTokens: entry.usageCompletionTokens,
          totalTokens: entry.usageTotalTokens,
        },
        hitCount: entry.hitCount + 1,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
      };
    } catch {
      instrumentCacheLatency("lookup", keyInput.provider, Date.now() - start);
      return null;
    }
  }

  async store(input: CacheSetInput): Promise<void> {
    const start = Date.now();
    instrumentCacheAction("store", input.provider);
    const now = new Date().toISOString();
    try {
      const db = getDb();
      await db.insert(aiCacheEntries).values({
        cacheKey: input.cacheKey,
        promptVersion: input.keyResult.promptVersion,
        schemaVersion: input.keyResult.schemaVersion,
        model: input.model,
        provider: input.provider,
        temperature: input.temperature,
        systemPromptHash: input.keyResult.systemPromptHash,
        messagesHash: input.keyResult.messagesHash,
        responseContent: input.result.content,
        responseModel: input.result.model,
        finishReason: input.result.finishReason,
        usagePromptTokens: input.result.usage.promptTokens,
        usageCompletionTokens: input.result.usage.completionTokens,
        usageTotalTokens: input.result.usage.totalTokens,
        hitCount: 1,
        createdAt: now,
        lastAccessedAt: now,
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        instrumentCacheAction("store_duplicate", input.provider);
      } else {
        instrumentCacheAction("store_error", input.provider);
        log.warn({ err: (err as Error).message }, "cache_store_error");
      }
    } finally {
      instrumentCacheLatency("store", input.provider, Date.now() - start);
    }
  }

  async invalidateByProvider(provider: string): Promise<number> {
    const start = Date.now();
    instrumentCacheAction("invalidate", provider);
    const db = getDb();
    const all = await db
      .select({ id: aiCacheEntries.id })
      .from(aiCacheEntries)
      .where(eq(aiCacheEntries.provider, provider));
    if (all.length > 0) {
      for (const row of all) {
        await db.delete(aiCacheEntries).where(eq(aiCacheEntries.id, row.id));
      }
    }
    instrumentCacheLatency("invalidate", provider, Date.now() - start);
    return all.length;
  }

  async invalidateByModel(model: string): Promise<number> {
    const start = Date.now();
    instrumentCacheAction("invalidate", model);
    const db = getDb();
    const all = await db
      .select({ id: aiCacheEntries.id })
      .from(aiCacheEntries)
      .where(eq(aiCacheEntries.model, model));
    if (all.length > 0) {
      for (const row of all) {
        await db.delete(aiCacheEntries).where(eq(aiCacheEntries.id, row.id));
      }
    }
    instrumentCacheLatency("invalidate", model, Date.now() - start);
    return all.length;
  }

  async invalidateAll(): Promise<number> {
    const start = Date.now();
    instrumentCacheAction("invalidate", "all");
    const db = getDb();
    const all = await db.select({ id: aiCacheEntries.id }).from(aiCacheEntries);
    if (all.length > 0) {
      await db.delete(aiCacheEntries);
    }
    instrumentCacheLatency("invalidate", "all", Date.now() - start);
    return all.length;
  }

  async getEntryCount(): Promise<number> {
    try {
      const db = getDb();
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(aiCacheEntries);
      return Number(result[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  async isVersionStale(): Promise<boolean> {
    try {
      const db = getDb();
      const latest = await db
        .select()
        .from(aiCacheEntries)
        .orderBy(sql`ROWID DESC`)
        .limit(1);
      if (latest.length === 0) return false;
      return latest[0]!.promptVersion < CACHE_PROMPT_VERSION;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{
    entryCount: number;
    totalHits: number;
    providers: string[];
    models: string[];
    promptVersion: number;
    schemaVersion: string;
    staleEntryCount: number;
    invalidationCount: number;
  }> {
    const entryCount = await this.getEntryCount();
    let totalHits = 0;
    let staleCount = 0;
    const providers = new Set<string>();
    const models = new Set<string>();
    try {
      const db = getDb();
      const rows = await db.select().from(aiCacheEntries);
      for (const r of rows) {
        totalHits += r.hitCount;
        providers.add(r.provider);
        models.add(r.model);
        if (r.promptVersion < CACHE_PROMPT_VERSION) staleCount++;
      }
    } catch {
      // return partial stats
    }
    let invalidationCount = 0;
    try {
      const db = getDb();
      const markers = await db.select({ count: sql<number>`COUNT(*)` }).from(aiCacheInvalidationMarkers);
      invalidationCount = Number(markers[0]?.count ?? 0);
    } catch {
      // ignore
    }
    return {
      entryCount,
      totalHits,
      providers: [...providers].sort(),
      models: [...models].sort(),
      promptVersion: CACHE_PROMPT_VERSION,
      schemaVersion: CACHE_SCHEMA_VERSION,
      staleEntryCount: staleCount,
      invalidationCount,
    };
  }

  async listEntries(limit = 50, offset = 0): Promise<CacheEntry[]> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(aiCacheEntries)
        .orderBy(sql`created_at DESC`)
        .limit(limit)
        .offset(offset);
      return rows.map((r) => ({
        id: r.id,
        cacheKey: r.cacheKey,
        responseContent: r.responseContent,
        responseModel: r.responseModel,
        finishReason: r.finishReason,
        usage: {
          promptTokens: r.usagePromptTokens,
          completionTokens: r.usageCompletionTokens,
          totalTokens: r.usageTotalTokens,
        },
        hitCount: r.hitCount,
        createdAt: r.createdAt,
        lastAccessedAt: r.lastAccessedAt,
      }));
    } catch {
      return [];
    }
  }

  async getEntryByKey(cacheKey: string): Promise<CacheEntry | null> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(aiCacheEntries)
        .where(eq(aiCacheEntries.cacheKey, cacheKey))
        .limit(1);
      if (rows.length === 0) return null;
      const r = rows[0]!;
      return {
        id: r.id,
        cacheKey: r.cacheKey,
        responseContent: r.responseContent,
        responseModel: r.responseModel,
        finishReason: r.finishReason,
        usage: {
          promptTokens: r.usagePromptTokens,
          completionTokens: r.usageCompletionTokens,
          totalTokens: r.usageTotalTokens,
        },
        hitCount: r.hitCount,
        createdAt: r.createdAt,
        lastAccessedAt: r.lastAccessedAt,
      };
    } catch {
      return null;
    }
  }

  async getInvalidationMarkers(): Promise<Array<{ markerKey: string; promptVersion: number; reason: string; createdAt: string }>> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(aiCacheInvalidationMarkers)
        .orderBy(sql`created_at DESC`)
        .limit(50);
      return rows.map((r) => ({
        markerKey: r.markerKey,
        promptVersion: r.promptVersion,
        reason: r.reason,
        createdAt: r.createdAt,
      }));
    } catch {
      return [];
    }
  }
}
