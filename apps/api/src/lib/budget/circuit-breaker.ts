import { logAudit } from "../audit/logger.js";
import type { CircuitBreakerConfig, CircuitState } from "./types.js";
import { DEFAULT_CIRCUIT_BREAKER } from "./types.js";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastStateChange = Date.now();
  private config: CircuitBreakerConfig;

  constructor(overrides?: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = {
      name: overrides?.name ?? "unnamed",
      failureThreshold: overrides?.failureThreshold ?? DEFAULT_CIRCUIT_BREAKER.failureThreshold,
      successThreshold: overrides?.successThreshold ?? DEFAULT_CIRCUIT_BREAKER.successThreshold,
      openTimeoutMs: overrides?.openTimeoutMs ?? DEFAULT_CIRCUIT_BREAKER.openTimeoutMs,
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  getName(): string {
    return this.config.name;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  allow(): boolean {
    if (this.state === "CLOSED") return true;
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.config.openTimeoutMs) {
        this.transitionTo("HALF_OPEN");
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo("CLOSED");
      }
    } else {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.successCount = 0;
    this.failureCount++;
    if (this.state === "HALF_OPEN" || this.failureCount >= this.config.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChange = Date.now();
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const prevState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    logAudit("circuit.state_change", "system", this.config.name, {
      circuitName: this.config.name,
      fromState: prevState,
      toState: newState,
      failureCount: this.failureCount,
    });
  }
}
