import { describe, expect, it, beforeEach } from "vitest";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenRouterProvider } from "./openrouter.js";
import { ProviderRequestError } from "./types.js";
import type { AIProvider, GenerationResult, ValidationResult } from "./types.js";

interface MockFetchEntry {
  url: string;
  status: number;
  body: unknown;
}

function mockFetch(entries: MockFetchEntry[]) {
  const originalFetch = globalThis.fetch;
  return {
    install() {
      globalThis.fetch = async (url: RequestInfo | URL, _options?: RequestInit): Promise<Response> => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const entry = entries.find((e) => urlStr.includes(e.url));
        if (!entry) throw new Error(`Unexpected fetch: ${urlStr}`);
        return {
          ok: entry.status >= 200 && entry.status < 300,
          status: entry.status,
          json: async () => entry.body,
          headers: new Headers(),
        } as Response;
      };
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

type ProviderFactory = (key: string) => AIProvider;

const PROVIDERS: { name: string; factory: ProviderFactory; apiKey: string }[] = [
  { name: "OpenAI", factory: (k) => new OpenAIProvider(k), apiKey: "sk-test" },
  { name: "Anthropic", factory: (k) => new AnthropicProvider(k), apiKey: "sk-ant-test" },
  { name: "OpenRouter", factory: (k) => new OpenRouterProvider(k), apiKey: "sk-or-test" },
];

describe("Provider contract — response normalization", () => {
  describe.each(PROVIDERS)("$name", ({ name: _n, factory, apiKey }) => {
    let provider: AIProvider;

    beforeEach(() => {
      provider = factory(apiKey);
    });

    it("normalizes a valid generation response to GenerationResult shape", async () => {
      const mockData = {
        openai: {
          choices: [{ message: { content: "Hello from OpenAI" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          model: "gpt-4o",
        },
        anthropic: {
          content: [{ text: "Hello from Anthropic" }],
          usage: { input_tokens: 10, output_tokens: 20 },
          model: "claude-sonnet-4-20250514",
          stop_reason: "end_turn",
        },
        openrouter: {
          choices: [{ message: { content: "Hello from OpenRouter" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          model: "openai/gpt-4o",
        },
      };

      const responses: Record<string, MockFetchEntry> = {
        openai: { url: "/chat/completions", status: 200, body: mockData.openai },
        anthropic: { url: "/messages", status: 200, body: mockData.anthropic },
        openrouter: { url: "/chat/completions", status: 200, body: mockData.openrouter },
      };

      const testMock = mockFetch([responses[name.toLowerCase()]!]);
      testMock.install();

      try {
        const result: GenerationResult = await provider.generate({
          model: "test-model",
          messages: [{ role: "user", content: "hi" }],
        });

        // All providers must return these fields
        expect(result).toHaveProperty("content");
        expect(typeof result.content).toBe("string");
        expect(result.content.length).toBeGreaterThan(0);

        expect(result).toHaveProperty("model");
        expect(typeof result.model).toBe("string");

        // Token usage must have all three fields
        expect(result.usage).toMatchObject({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        });
        expect(result.usage.totalTokens).toBe(result.usage.promptTokens + result.usage.completionTokens);

        // finishReason must be a non-empty string
        expect(result.finishReason).toBeTruthy();
        expect(typeof result.finishReason).toBe("string");
      } finally {
        testMock.restore();
      }
    });

    it("maps 4xx errors to non-retryable ProviderRequestError", async () => {
      const testMock = mockFetch([{ url: "/", status: 400, body: { error: { message: "Bad request" } } }]);
      testMock.install();

      try {
        await expect(
          provider.generate({ model: "m", messages: [{ role: "user", content: "hi" }] }),
        ).rejects.toMatchObject({
          retryable: false,
          statusCode: 400,
        });
      } finally {
        testMock.restore();
      }
    });

    it("maps 5xx errors to retryable ProviderRequestError", async () => {
      const testMock = mockFetch([
        { url: "/", status: 503, body: { error: { message: "Service unavailable" } } },
      ]);
      testMock.install();

      try {
        await expect(
          provider.generate({ model: "m", messages: [{ role: "user", content: "hi" }] }),
        ).rejects.toMatchObject({
          retryable: true,
          statusCode: 503,
        });
      } finally {
        testMock.restore();
      }
    });

    it("maps 429 errors to retryable ProviderRequestError", async () => {
      const testMock = mockFetch([{ url: "/", status: 429, body: { error: { message: "Rate limited" } } }]);
      testMock.install();

      try {
        await expect(
          provider.generate({ model: "m", messages: [{ role: "user", content: "hi" }] }),
        ).rejects.toMatchObject({
          retryable: true,
          statusCode: 429,
        });
      } finally {
        testMock.restore();
      }
    });

    it("handles malformed response with missing choices/data", async () => {
      const testMock = mockFetch([
        { url: "/", status: 200, body: {} }, // empty response
      ]);
      testMock.install();

      try {
        const result = await provider.generate({
          model: "m",
          messages: [{ role: "user", content: "hi" }],
        });
        // Must not throw — provider should handle gracefully
        expect(result.content).toBe("");
        expect(result.usage.totalTokens).toBe(0);
        expect(result.finishReason).toBeTruthy();
      } finally {
        testMock.restore();
      }
    });

    it("handles malformed response with null usage", async () => {
      const partialBody = {
        openai: { choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: null },
        anthropic: { content: [{ text: "ok" }], usage: null, stop_reason: "end_turn" },
        openrouter: { choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: null },
      };

      const testMock = mockFetch([
        { url: "/", status: 200, body: partialBody[name.toLowerCase() as keyof typeof partialBody] },
      ]);
      testMock.install();

      try {
        const result = await provider.generate({
          model: "m",
          messages: [{ role: "user", content: "hi" }],
        });
        expect(result.content).toBe("ok");
        expect(result.usage.totalTokens).toBe(0);
      } finally {
        testMock.restore();
      }
    });

    it("validates credential rejection", async () => {
      const testMock = mockFetch([{ url: "/", status: 401, body: { error: { message: "Unauthorized" } } }]);
      testMock.install();

      try {
        const result: ValidationResult = await provider.validate();
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
      } finally {
        testMock.restore();
      }
    });

    it("handles network-level errors gracefully", async () => {
      const testMock = mockFetch([]);
      testMock.install();

      try {
        // No matching entry → fetch throws → validate should catch
        // But this only works if the provider catches fetch errors
        // For non-mocked URLs, it'll throw "Unexpected fetch"
        // If the provider doesn't handle that, the test verifies the error shape
        await expect(
          provider.generate({ model: "m", messages: [{ role: "user", content: "hi" }] }),
        ).rejects.toThrow();
      } finally {
        testMock.restore();
      }
    });

    it("reports the correct provider name", () => {
      const provider = factory(apiKey);
      expect(provider.provider).toBe(name.toLowerCase());
    });
  });
});

describe("ProviderRequestError — cross-provider consistency", () => {
  const cases = [
    { provider: "openai", status: 400, retryable: false },
    { provider: "openai", status: 429, retryable: true },
    { provider: "openai", status: 502, retryable: true },
    { provider: "anthropic", status: 401, retryable: false },
    { provider: "anthropic", status: 500, retryable: true },
    { provider: "openrouter", status: 403, retryable: false },
    { provider: "openrouter", status: 503, retryable: true },
  ];

  for (const { provider, status, retryable } of cases) {
    it(`${provider} ${status} → retryable=${retryable}`, () => {
      const err = new ProviderRequestError(provider, status, "test");
      expect(err.retryable).toBe(retryable);
      expect(err.code).toBe(`PROVIDER_${status}`);
      expect(err.providerName).toBe(provider);
      expect(err.statusCode).toBe(status);
    });
  }
});

describe("Provider validation — credential patterns", () => {
  describe.each(PROVIDERS)("$name", ({ name: _n, factory }) => {
    it("rejects empty API key", async () => {
      const provider = factory("");
      const result = await provider.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("rejects whitespace-only API key", async () => {
      const provider = factory("   ");
      const result = await provider.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
