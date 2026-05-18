import type { BudgetConfig, BudgetState, BudgetCheckResult, GenerationOutcome } from "./types.js";
import { DEFAULT_BUDGET } from "./types.js";

export interface BudgetStore {
  getConfig(scope: string): BudgetConfig | undefined;
  setConfig(config: BudgetConfig): void;
  getState(scope: string): BudgetState | undefined;
  upsertState(state: BudgetState): void;
}

export function createInMemoryBudgetStore(maxEntries = 1000): BudgetStore {
  const configs = new Map<string, BudgetConfig>();
  const states = new Map<string, BudgetState>();
  const insertionOrder: string[] = [];

  function touch(id: string): void {
    // Move to end (most recently used)
    const idx = insertionOrder.indexOf(id);
    if (idx !== -1) insertionOrder.splice(idx, 1);
    insertionOrder.push(id);
  }

  function evictIfNeeded(): void {
    while (insertionOrder.length > maxEntries) {
      const oldest = insertionOrder.shift();
      if (oldest) {
        configs.delete(oldest);
        states.delete(oldest);
      }
    }
  }

  return {
    getConfig(id) {
      return configs.get(id);
    },
    setConfig(c) {
      configs.set(c.projectId, c);
      touch(c.projectId);
      evictIfNeeded();
    },
    getState(id) {
      return states.get(id);
    },
    upsertState(s) {
      states.set(s.projectId, s);
      touch(s.projectId);
      evictIfNeeded();
    },
  };
}

function getMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ensureState(store: BudgetStore, scopeId: string): BudgetState {
  const existing = store.getState(scopeId);
  const monthKey = getMonthKey();
  if (existing && existing.lastResetAt.startsWith(monthKey)) return existing;
  const fresh: BudgetState = {
    projectId: scopeId,
    currentMonthGenerations: 0,
    currentMonthTokens: 0,
    currentMonthCost: 0,
    lastResetAt: new Date().toISOString(),
  };
  store.upsertState(fresh);
  return fresh;
}

function makeConfig(scopeId: string, overrides?: Partial<BudgetConfig>): BudgetConfig {
  return {
    projectId: scopeId,
    maxEstimatedCost: overrides?.maxEstimatedCost ?? DEFAULT_BUDGET.maxEstimatedCost,
    maxGenerationsPerMonth: overrides?.maxGenerationsPerMonth ?? DEFAULT_BUDGET.maxGenerationsPerMonth,
    maxTokensPerMonth: overrides?.maxTokensPerMonth ?? DEFAULT_BUDGET.maxTokensPerMonth,
  };
}

export class BudgetEnforcer {
  constructor(private store: BudgetStore) {}

  setProjectBudget(projectId: string, overrides?: Partial<BudgetConfig>): void {
    this.store.setConfig(makeConfig(projectId, overrides));
  }

  setUserBudget(userId: string, overrides?: Partial<BudgetConfig>): void {
    this.store.setConfig(makeConfig(`user:${userId}`, overrides));
  }

  private getConfig(scopeId: string): BudgetConfig {
    return this.store.getConfig(scopeId) ?? makeConfig(scopeId);
  }

  checkGeneration(scopeId: string, estimatedCost: number, estimatedTokens: number): BudgetCheckResult {
    const config = this.getConfig(scopeId);
    const state = ensureState(this.store, scopeId);
    const remainingBudget = config.maxEstimatedCost - state.currentMonthCost;
    const wouldExceedCost = state.currentMonthCost + estimatedCost > config.maxEstimatedCost;
    const wouldExceedGenerations = state.currentMonthGenerations + 1 > config.maxGenerationsPerMonth;
    const wouldExceedTokens = state.currentMonthTokens + estimatedTokens > config.maxTokensPerMonth;

    let reason: string | null = null;
    if (wouldExceedCost)
      reason = `Estimated cost $${estimatedCost.toFixed(6)} would exceed remaining budget $${remainingBudget.toFixed(6)}`;
    else if (wouldExceedGenerations)
      reason = `Generation would exceed monthly limit of ${config.maxGenerationsPerMonth}`;
    else if (wouldExceedTokens)
      reason = `Token usage would exceed monthly limit of ${config.maxTokensPerMonth.toLocaleString()}`;

    return {
      allowed: !reason,
      reason,
      estimatedCost,
      estimatedTokens,
      currentMonthCost: state.currentMonthCost,
      currentMonthGenerations: state.currentMonthGenerations,
      remainingBudget,
    };
  }

  checkProjectAndUser(
    projectId: string,
    userId: string,
    estimatedCost: number,
    estimatedTokens: number,
  ): BudgetCheckResult[] {
    return [
      this.checkGeneration(projectId, estimatedCost, estimatedTokens),
      this.checkGeneration(`user:${userId}`, estimatedCost, estimatedTokens),
    ];
  }

  recordOutcome(scopeId: string, cost: number, tokens: number, outcome: GenerationOutcome): void {
    const state = ensureState(this.store, scopeId);
    state.currentMonthGenerations++;
    if (outcome === "completed") {
      state.currentMonthTokens += tokens;
      state.currentMonthCost += cost;
    }
    this.store.upsertState(state);
  }
}
