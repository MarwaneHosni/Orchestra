import { describe, expect, it } from "vitest";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenRouterProvider } from "./openrouter.js";
import { ProviderRequestError, fetchWithTimeout } from "./types.js";

describe("OpenAIProvider", () => {
  it("rejects empty key on validate", async () => {
    const provider = new OpenAIProvider("");
    const result = await provider.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("lists models with invalid key (returns empty)", async () => {
    const provider = new OpenAIProvider("sk-invalid");
    const models = await provider.listModels();
    expect(Array.isArray(models)).toBe(true);
  });

  it("throws on generate with invalid key", async () => {
    const provider = new OpenAIProvider("sk-invalid");
    await expect(
      provider.generate({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow();
  });
});

describe("AnthropicProvider", () => {
  it("rejects empty key on validate", async () => {
    const provider = new AnthropicProvider("");
    const result = await provider.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("lists models with invalid key (returns empty)", async () => {
    const provider = new AnthropicProvider("sk-ant-invalid");
    const models = await provider.listModels();
    expect(Array.isArray(models)).toBe(true);
  });

  it("throws on generate with invalid key", async () => {
    const provider = new AnthropicProvider("sk-ant-invalid");
    await expect(
      provider.generate({ model: "claude-sonnet-4-20250514", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow();
  });
});

describe("OpenRouterProvider", () => {
  it("rejects empty key on validate", async () => {
    const provider = new OpenRouterProvider("");
    const result = await provider.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("lists models with invalid key (returns empty)", async () => {
    const provider = new OpenRouterProvider("sk-or-invalid");
    const models = await provider.listModels();
    expect(Array.isArray(models)).toBe(true);
  });

  it("throws on generate with invalid key", async () => {
    const provider = new OpenRouterProvider("sk-or-invalid");
    await expect(
      provider.generate({ model: "openai/gpt-4o", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow();
  });
});

describe("Common interface across providers", () => {
  const providers = [
    { name: "OpenAI", create: () => new OpenAIProvider("sk-test") },
    { name: "Anthropic", create: () => new AnthropicProvider("sk-ant-test") },
    { name: "OpenRouter", create: () => new OpenRouterProvider("sk-or-test") },
  ];

  for (const { name, create } of providers) {
    it(`${name} implements all AIProvider methods`, () => {
      const p = create();
      expect(p.provider).toBeTypeOf("string");
      expect(p.validate).toBeTypeOf("function");
      expect(p.listModels).toBeTypeOf("function");
      expect(p.generate).toBeTypeOf("function");
    });
  }
});

describe("ProviderRequestError", () => {
  it("marks 5xx errors as retryable", () => {
    const err = new ProviderRequestError("openai", 503, "Service unavailable");
    expect(err.retryable).toBe(true);
    expect(err.code).toBe("PROVIDER_503");
    expect(err.providerName).toBe("openai");
  });

  it("marks 429 errors as retryable", () => {
    const err = new ProviderRequestError("anthropic", 429, "Rate limited");
    expect(err.retryable).toBe(true);
  });

  it("marks 4xx errors (except 429) as non-retryable", () => {
    const err = new ProviderRequestError("openrouter", 400, "Bad request");
    expect(err.retryable).toBe(false);
  });

  it("is instance of Error", () => {
    expect(new ProviderRequestError("openai", 500, "")).toBeInstanceOf(Error);
  });
});

describe("fetchWithTimeout", () => {
  it("rejects when the signal is aborted", async () => {
    const controller = new AbortController();
    const promise = fetchWithTimeout("http://localhost:1", { signal: controller.signal, timeout: 5000 });
    controller.abort();
    await expect(promise).rejects.toThrow();
  });
});
