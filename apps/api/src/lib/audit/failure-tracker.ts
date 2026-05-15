export interface FailureEvent {
  provider: string;
  timestamp: number;
  category: string;
}

export interface SpikeAlert {
  provider: string;
  failures: number;
  windowMs: number;
  firstFailure: number;
  lastFailure: number;
}

export class FailureSpikeDetector {
  private events: FailureEvent[] = [];
  private readonly windowMs: number;
  private readonly threshold: number;

  constructor(windowMs: number = 5 * 60_000, threshold: number = 3) {
    this.windowMs = windowMs;
    this.threshold = threshold;
  }

  record(provider: string, category: string): SpikeAlert | null {
    const now = Date.now();
    this.events.push({ provider, timestamp: now, category });
    this.events = this.events.filter((e) => now - e.timestamp < this.windowMs);

    const recent = this.events.filter((e) => e.provider === provider && now - e.timestamp < this.windowMs);

    if (recent.length >= this.threshold) {
      return {
        provider,
        failures: recent.length,
        windowMs: this.windowMs,
        firstFailure: recent[0]!.timestamp,
        lastFailure: now,
      };
    }

    return null;
  }

  getRecentFailures(provider: string, windowMs?: number): FailureEvent[] {
    const cutoff = Date.now() - (windowMs ?? this.windowMs);
    return this.events.filter((e) => e.provider === provider && e.timestamp >= cutoff);
  }

  reset(): void {
    this.events = [];
  }
}
