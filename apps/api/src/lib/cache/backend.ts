import type { GenerationResult } from "../provider/types.js";
import type { CacheKeyInput, CacheKeyResult } from "./key-builder.js";

export interface CacheEntry {
  id: number | string;
  cacheKey: string;
  responseContent: string;
  responseModel: string;
  finishReason: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  hitCount: number;
  createdAt: string;
  lastAccessedAt: string;
}

export interface CacheSetInput {
  cacheKey: string;
  keyResult: CacheKeyResult;
  model: string;
  provider: string;
  temperature: number;
  result: GenerationResult;
}

export interface CacheBackend {
  lookup(key: CacheKeyInput, keyResult: CacheKeyResult): Promise<CacheEntry | null>;
  store(input: CacheSetInput): Promise<void>;
  invalidateByProvider(provider: string): Promise<number>;
  invalidateByModel(model: string): Promise<number>;
  invalidateAll(): Promise<number>;
  getEntryCount(): Promise<number>;
  isVersionStale(): Promise<boolean>;
  getStats(): Promise<{
    entryCount: number;
    totalHits: number;
    providers: string[];
    models: string[];
    promptVersion: number;
    schemaVersion: string;
    staleEntryCount: number;
    invalidationCount: number;
  }>;
  listEntries(limit?: number, offset?: number): Promise<CacheEntry[]>;
  getEntryByKey(cacheKey: string): Promise<CacheEntry | null>;
  getInvalidationMarkers(): Promise<Array<{ markerKey: string; promptVersion: number; reason: string; createdAt: string }>>;
}
