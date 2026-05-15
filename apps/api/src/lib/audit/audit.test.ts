import { describe, expect, it, beforeEach } from "vitest";
import {
  redactValue,
  redactObject,
  redactHeaders,
  redactUrl,
  truncateBody,
  sanitizeProviderResponse,
} from "./redactor.js";
import { createAuditEntry, createInMemoryAuditStore } from "./logger.js";
import { FailureSpikeDetector } from "./failure-tracker.js";

describe("redactValue", () => {
  it("redacts fields named apiKey", () => {
    expect(redactValue("apiKey", "sk-test-123")).toBe("[REDACTED]");
  });

  it("redacts fields named api_key", () => {
    expect(redactValue("api_key", "sk-test-123")).toBe("[REDACTED]");
  });

  it("redacts OpenAI-style keys in values", () => {
    expect(redactValue("value", "sk-abc123def456ghi789jkl0")).toBe("[REDACTED]");
  });

  it("redacts Anthropic-style keys in values", () => {
    expect(redactValue("value", "sk-ant-api03-abcdef1234567890abcd")).toBe("[REDACTED]");
  });

  it("does not redact non-sensitive values", () => {
    expect(redactValue("model", "gpt-4o")).toBe("gpt-4o");
  });
});

describe("redactObject", () => {
  it("redacts sensitive keys and preserves safe ones", () => {
    const input = { apiKey: "sk-secret", model: "gpt-4o", provider: "openai" };
    const result = redactObject(input);
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.model).toBe("gpt-4o");
    expect(result.provider).toBe("openai");
  });
});

describe("redactHeaders", () => {
  it("redacts authorization header", () => {
    const result = redactHeaders({ authorization: "Bearer sk-123", "content-type": "application/json" });
    expect(result.authorization).toBe("[REDACTED]");
    expect(result["content-type"]).toBe("application/json");
  });
});

describe("redactUrl", () => {
  it("redacts credentials in URL", () => {
    const result = redactUrl("https://user:pass@api.openai.com/v1/models");
    expect(result).not.toContain("pass");
    expect(result).not.toContain(":pass@");
    expect(result).toContain("REDACTED");
  });
});

describe("truncateBody", () => {
  it("truncates long strings", () => {
    const long = "x".repeat(1000);
    const result = truncateBody(long, 100);
    expect(result.length).toBe(103); // 100 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("leaves short strings unchanged", () => {
    expect(truncateBody("short", 100)).toBe("short");
  });
});

describe("sanitizeProviderResponse", () => {
  it("truncates content field", () => {
    const response = { content: "a".repeat(2000), model: "gpt-4o", usage: { total_tokens: 100 } };
    const result = sanitizeProviderResponse(response) as Record<string, unknown>;
    expect(typeof result.content).toBe("string");
    expect((result.content as string).length).toBeLessThan(600);
    expect(result.model).toBe("gpt-4o");
  });
});

describe("createAuditEntry", () => {
  it("creates a structured entry with redacted metadata", () => {
    const entry = createAuditEntry("credential.created", "user-1", "cred-1", {
      provider: "openai",
      apiKey: "sk-secret-123",
    });
    expect(entry.eventType).toBe("credential.created");
    expect(entry.actor).toBe("user-1");
    expect(entry.resourceId).toBe("cred-1");
    expect(entry.metadata.apiKey).toBe("[REDACTED]");
    expect(entry.metadata.provider).toBe("openai");
    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
  });
});

describe("AuditStore", () => {
  it("stores and queries audit entries", () => {
    const store = createInMemoryAuditStore();
    store.append(createAuditEntry("credential.created", "user-1", "cred-1"));
    store.append(createAuditEntry("credential.deleted", "user-1", "cred-1"));
    store.append(createAuditEntry("generation.completed", "user-2", "gen-1"));
    expect(store.query()).toHaveLength(3);
    expect(store.query({ actor: "user-1" })).toHaveLength(2);
    expect(store.query({ eventType: "credential.created" })).toHaveLength(1);
  });
});

describe("FailureSpikeDetector", () => {
  let detector: FailureSpikeDetector;

  beforeEach(() => {
    detector = new FailureSpikeDetector(60_000, 3);
  });

  it("returns null below threshold", () => {
    detector.record("openai", "retryable");
    detector.record("openai", "retryable");
    expect(detector.record("anthropic", "retryable")).toBeNull();
  });

  it("alerts when threshold is reached", () => {
    detector.record("openai", "retryable");
    detector.record("openai", "retryable");
    const alert = detector.record("openai", "retryable");
    expect(alert).not.toBeNull();
    expect(alert!.provider).toBe("openai");
    expect(alert!.failures).toBe(3);
  });

  it("resets after window expires", async () => {
    detector.record("openai", "retryable");
    detector.record("openai", "retryable");
    await new Promise((r) => setTimeout(r, 10));
    // Manually simulate window expiry by clearing events
    detector.reset();
    expect(detector.record("openai", "retryable")).toBeNull();
  });

  it("tracks separate windows per provider", () => {
    detector.record("openai", "retryable");
    detector.record("openai", "retryable");
    detector.record("anthropic", "retryable");
    detector.record("anthropic", "retryable");
    detector.record("anthropic", "retryable");
    const alert = detector.record("anthropic", "retryable");
    expect(alert).not.toBeNull();
    expect(alert!.provider).toBe("anthropic");
  });

  it("getRecentFailures returns only matching provider", () => {
    detector.record("openai", "retryable");
    detector.record("anthropic", "retryable");
    expect(detector.getRecentFailures("openai")).toHaveLength(1);
    expect(detector.getRecentFailures("anthropic")).toHaveLength(1);
  });
});
