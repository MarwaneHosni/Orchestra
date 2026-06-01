import type { CacheKeyInput } from "./key-builder.js";
import { buildCacheKey } from "./key-builder.js";
import type { CacheBackend, CacheEntry, CacheSetInput } from "./backend.js";
import { SqliteCacheBackend } from "./sqlite-backend.js";

export type { CacheEntry, CacheSetInput } from "./backend.js";

export class ContentAddressableCache {
  private backend: CacheBackend;

  constructor(backend?: CacheBackend) {
    this.backend = backend ?? new SqliteCacheBackend();
  }

  async lookup(input: CacheKeyInput): Promise<CacheEntry | null> {
    const key = buildCacheKey(input);
    return this.backend.lookup(input, key);
  }

  async store(input: CacheSetInput): Promise<void> {
    return this.backend.store(input);
  }

  async invalidateByProvider(provider: string): Promise<number> {
    return this.backend.invalidateByProvider(provider);
  }

  async invalidateByModel(model: string): Promise<number> {
    return this.backend.invalidateByModel(model);
  }

  async invalidateAll(): Promise<number> {
    return this.backend.invalidateAll();
  }

  async getEntryCount(): Promise<number> {
    return this.backend.getEntryCount();
  }

  async isVersionStale(): Promise<boolean> {
    return this.backend.isVersionStale();
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
    return this.backend.getStats();
  }

  async listEntries(limit?: number, offset?: number): Promise<CacheEntry[]> {
    return this.backend.listEntries(limit, offset);
  }

  async getEntryByKey(cacheKey: string): Promise<CacheEntry | null> {
    return this.backend.getEntryByKey(cacheKey);
  }

  async getInvalidationMarkers(): Promise<Array<{ markerKey: string; promptVersion: number; reason: string; createdAt: string }>> {
    return this.backend.getInvalidationMarkers();
  }
}

export const globalCache = new ContentAddressableCache();
