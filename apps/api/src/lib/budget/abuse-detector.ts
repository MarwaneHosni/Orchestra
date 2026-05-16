import type { AbuseConfig, AbuseRecord } from "./types.js";
import { DEFAULT_ABUSE_CONFIG } from "./types.js";

export interface AbuseAlert {
  scope: string;
  failureCount: number;
  blockedUntil: number;
}

export class AbuseDetector {
  private records = new Map<string, AbuseRecord>();
  private config: AbuseConfig;

  constructor(config?: Partial<AbuseConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? DEFAULT_ABUSE_CONFIG.failureThreshold,
      windowMs: config?.windowMs ?? DEFAULT_ABUSE_CONFIG.windowMs,
      blockDurationMs: config?.blockDurationMs ?? DEFAULT_ABUSE_CONFIG.blockDurationMs,
    };
  }

  recordFailure(scope: string): AbuseAlert | null {
    const now = Date.now();
    let record = this.records.get(scope);

    if (!record) {
      record = { failures: [], blockedUntil: null };
      this.records.set(scope, record);
    }

    if (record.blockedUntil !== null && now < record.blockedUntil) {
      return {
        scope,
        failureCount: record.failures.length,
        blockedUntil: record.blockedUntil,
      };
    }

    if (record.blockedUntil !== null && now >= record.blockedUntil) {
      record.failures = [];
      record.blockedUntil = null;
    }

    record.failures.push({ timestamp: now });
    const cutoff = now - this.config.windowMs;
    record.failures = record.failures.filter((f) => f.timestamp >= cutoff);

    if (record.failures.length >= this.config.failureThreshold) {
      record.blockedUntil = now + this.config.blockDurationMs;
      return {
        scope,
        failureCount: record.failures.length,
        blockedUntil: record.blockedUntil,
      };
    }

    return null;
  }

  isBlocked(scope: string): boolean {
    const record = this.records.get(scope);
    if (!record || record.blockedUntil === null) return false;
    if (Date.now() >= record.blockedUntil) {
      record.failures = [];
      record.blockedUntil = null;
      return false;
    }
    return true;
  }

  getBlockedUntil(scope: string): number | null {
    const record = this.records.get(scope);
    if (!record || record.blockedUntil === null) return null;
    if (Date.now() >= record.blockedUntil) {
      record.failures = [];
      record.blockedUntil = null;
      return null;
    }
    return record.blockedUntil;
  }

  clear(scope: string): void {
    this.records.delete(scope);
  }

  reset(): void {
    this.records.clear();
  }

  getFailureCount(scope: string): number {
    const record = this.records.get(scope);
    if (!record) return 0;
    const cutoff = Date.now() - this.config.windowMs;
    return record.failures.filter((f) => f.timestamp >= cutoff).length;
  }
}
