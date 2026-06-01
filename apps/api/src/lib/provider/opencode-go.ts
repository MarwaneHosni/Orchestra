import type { AIProvider, GenerationInput, GenerationResult, ModelInfo, ValidationResult } from "./types.js";
import { ProviderRequestError, fetchWithTimeout } from "./types.js";
import { createModuleLogger } from "../logging/logger.js";

const log = createModuleLogger("opencode-go");

const BASE_URL = "https://opencode.ai/zen/go/v1";
const GENERATE_TIMEOUT_MS = 180_000;

const GO_MODEL_IDS = new Set([
  "glm-5.1",
  "glm-5",
  "kimi-k2.5",
  "kimi-k2.6",
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "mimo-v2.5",
  "mimo-v2.5-pro",
  "qwen3.6-plus",
  "qwen3.5-plus",
]);

export class OpencodeGoProvider implements AIProvider {
  readonly provider = "opencode-go";

  constructor(private apiKey: string) {}

  private async apiFetch(path: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
    return fetchWithTimeout(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async validate(): Promise<ValidationResult> {
    try {
      const res = await this.apiFetch("/models");
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      if (!res.ok) return { valid: false, error: `OpenCode Go API error: ${res.status}` };
      const body = (await res.json()) as { data?: { id: string }[] };
      const models: ModelInfo[] = (body.data ?? [])
        .filter((m) => GO_MODEL_IDS.has(m.id))
        .map((m) => ({ id: m.id, provider: "opencode-go" }));
      return { valid: true, models };
    } catch (err) {
      if (err instanceof ProviderRequestError) {
        return { valid: false, error: err.message };
      }
      return {
        valid: false,
        error: `OpenCode Go connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await this.apiFetch("/models");
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? [])
        .filter((m) => GO_MODEL_IDS.has(m.id))
        .map((m) => ({ id: m.id, provider: "opencode-go" }));
    } catch {
      return [];
    }
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const messages: { role: string; content: string }[] = [];
    if (input.systemPrompt) messages.push({ role: "system", content: input.systemPrompt });
    messages.push(...input.messages);

    const apiModel = input.model;
    log.debug({ model: input.model, hasApiKey: this.apiKey.length > 0, url: `${BASE_URL}/chat/completions` }, "sending_request");

    const res = await this.apiFetch("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: GENERATE_TIMEOUT_MS,
      body: JSON.stringify({
        model: apiModel,
        messages,
        temperature: input.temperature ?? 0.7,
        stream: false,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "(could not read body)");
      let parsedError: unknown;
      try {
        parsedError = JSON.parse(bodyText);
      } catch {
        parsedError = bodyText;
      }
      const errObj = parsedError as Record<string, unknown>;
      const errMsg =
        typeof errObj?.error === "object" && errObj.error !== null
          ? ((errObj.error as Record<string, unknown>)?.message ?? JSON.stringify(errObj.error))
          : typeof errObj?.error === "string"
            ? errObj.error
            : bodyText;

      log.warn({ status: res.status, statusText: res.statusText, bodyPreview: bodyText.slice(0, 500) }, "api_error");

      throw new ProviderRequestError(
        "opencode-go",
        res.status,
        typeof errMsg === "string" ? errMsg : `OpenCode Go API error: ${res.status}`,
      );
    }

    const rawText = await res.text();
    log.debug({ model: input.model, status: res.status, rawLength: rawText.length, contentType: res.headers.get("content-type") }, "response_body");

    const body = JSON.parse(rawText) as {
      choices?: { message?: Record<string, unknown>; finish_reason?: string }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?: string;
    };

    const msg = body.choices?.[0]?.message;
    const content =
      (msg?.content as string | undefined) || (msg?.reasoning_content as string | undefined) || "";

    return {
      content,
      model: body.model ?? input.model,
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
        totalTokens: body.usage?.total_tokens ?? 0,
      },
      finishReason: body.choices?.[0]?.finish_reason ?? "stop",
    };
  }
}
