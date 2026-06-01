import { createHash } from "node:crypto";
import type { Message } from "../provider/types.js";

export const CACHE_PROMPT_VERSION = 1;
export const CACHE_SCHEMA_VERSION = "orchestra-generated-v1";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface CacheKeyInput {
  systemPrompt: string;
  messages: Message[];
  model: string;
  provider: string;
  temperature: number;
}

export interface CacheKeyResult {
  cacheKey: string;
  systemPromptHash: string;
  messagesHash: string;
  promptVersion: number;
  schemaVersion: string;
}

export function buildCacheKey(input: CacheKeyInput): CacheKeyResult {
  const systemPromptHash = sha256Hex(input.systemPrompt);
  const messagesStr = JSON.stringify(input.messages);
  const messagesHash = sha256Hex(messagesStr);

  const composite = [
    String(CACHE_PROMPT_VERSION),
    CACHE_SCHEMA_VERSION,
    systemPromptHash,
    messagesHash,
    input.model,
    input.provider,
    String(input.temperature),
  ].join("::");

  const cacheKey = sha256Hex(composite);

  return {
    cacheKey,
    systemPromptHash,
    messagesHash,
    promptVersion: CACHE_PROMPT_VERSION,
    schemaVersion: CACHE_SCHEMA_VERSION,
  };
}
