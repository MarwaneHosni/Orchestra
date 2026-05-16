import { describe, expect, it } from "vitest";
import { RouterService } from "./router.js";
import { POLICIES } from "./policy.js";
import type { ProviderStatus } from "./types.js";

function allAvailable(): ProviderStatus {
  return { provider: "", available: true, validatedAt: new Date().toISOString() };
}

function makeStatus(availableProviders: string[]): (provider: string) => ProviderStatus {
  const set = new Set(availableProviders);
  return (p: string) => ({
    provider: p,
    available: set.has(p),
    validatedAt: set.has(p) ? new Date().toISOString() : null,
  });
}

describe("RouterService", () => {
  describe("select — basic routing", () => {
    it("returns a selection for each task type", () => {
      const router = new RouterService(() => allAvailable());
      for (const task of [
        "clarification",
        "roadmap",
        "architecture",
        "prompt_generation",
        "summary",
      ] as const) {
        const decision = router.select(task);
        expect(decision.taskType).toBe(task);
        expect(decision.selection).toBeDefined();
        expect(decision.selection.model).toBeTypeOf("string");
        expect(decision.selection.provider).toBeTypeOf("string");
        expect(decision.selection.tier).toBeTypeOf("string");
        expect(Array.isArray(decision.reasoning)).toBe(true);
        expect(decision.reasoning.length).toBeGreaterThan(0);
      }
    });

    it("contains fallback chain in decision", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("architecture");
      expect(decision.fallbackChain.length).toBeGreaterThan(0);
    });

    it("sets usedFallback to false when primary is available", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("clarification");
      expect(decision.usedFallback).toBe(false);
    });
  });

  describe("fallback behavior", () => {
    it("uses fallback when preferred provider is down", () => {
      const status = makeStatus(["anthropic"]);
      const router = new RouterService(status);
      const decision = router.select("clarification");
      expect(decision.selection.provider).toBe("anthropic");
      expect(decision.usedFallback).toBe(false);
    });

    it("falls through entire chain and picks last available", () => {
      const status = makeStatus(["openai"]);
      const router = new RouterService(status);
      const decision = router.select("architecture");
      expect(decision.selection).toBeDefined();
      expect(decision.selection.provider).toBe("openai");
    });
  });

  describe("user preferences", () => {
    it("respects preferred provider when available", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("summary", { preferredProvider: "anthropic" });
      expect(decision.selection.provider).toBe("anthropic");
    });

    it("uses preferred list when user preference is unavailable", () => {
      const status = makeStatus(["openai"]);
      const router = new RouterService(status);
      const decision = router.select("summary", { preferredProvider: "anthropic" });
      expect(decision.selection.provider).toBe("openai");
    });

    it("respects qualityThreshold by filtering out models below the threshold", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("architecture", { qualityThreshold: "strong" });
      expect(decision.selection.tier).toBe("strong");
      expect(decision.usedFallback).toBe(false);
    });

    it("falls back when no preferred models meet qualityThreshold", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("summary", { qualityThreshold: "balanced" });
      expect(decision.selection.tier).toBe("balanced");
      expect(decision.usedFallback).toBe(true);
    });

    it("falls back to next meeting tier when preferred tier is unavailable", () => {
      const status = makeStatus(["openai"]);
      const router = new RouterService(status);
      const decision = router.select("architecture", { qualityThreshold: "balanced" });
      expect(decision.selection).toBeDefined();
    });
  });

  describe("explainable decisions", () => {
    it("includes reasoning trace", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("architecture");
      expect(decision.reasoning.length).toBeGreaterThanOrEqual(2);
      expect(decision.reasoning[0]).toContain("Policy");
      expect(decision.reasoning[decision.reasoning.length - 1]).toContain("Selected");
    });

    it("includes timestamp", () => {
      const router = new RouterService(() => allAvailable());
      const decision = router.select("roadmap");
      expect(decision.timestamp).toBeDefined();
      expect(() => new Date(decision.timestamp)).not.toThrow();
    });
  });

  describe("unknown task type", () => {
    it("throws for unknown task type", () => {
      const router = new RouterService(() => allAvailable());
      expect(() => (router as any).select("unknown")).toThrow("No routing policy");
    });
  });
});

describe("POLICIES", () => {
  it("has entries for all 6 task types", () => {
    const types = POLICIES.map((p) => p.taskType).sort();
    expect(types).toEqual(
      ["architecture", "blueprint", "clarification", "prompt_generation", "roadmap", "summary"].sort(),
    );
  });

  it("each policy has at least one preferred and one fallback", () => {
    for (const policy of POLICIES) {
      expect(policy.preferred.length).toBeGreaterThan(0);
      expect(policy.fallback.length).toBeGreaterThan(0);
    }
  });

  it("clarification uses cheap tier", () => {
    const policy = POLICIES.find((p) => p.taskType === "clarification");
    expect(policy?.minTier).toBe("cheap");
  });

  it("architecture uses strong tier", () => {
    const policy = POLICIES.find((p) => p.taskType === "architecture");
    expect(policy?.minTier).toBe("strong");
  });
});
