import type { AIProvider, GenerationInput, GenerationResult, ModelInfo, ValidationResult } from "./types.js";
import { ProviderRequestError, fetchWithTimeout } from "./types.js";

const BASE_URL = "https://api.anthropic.com/v1";

export class AnthropicProvider implements AIProvider {
  readonly provider = "anthropic";

  constructor(private apiKey: string) {}

  private async apiFetch(path: string, options?: RequestInit): Promise<Response> {
    return fetchWithTimeout(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...options?.headers,
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
  }

  async validate(): Promise<ValidationResult> {
    try {
      const res = await this.apiFetch("/models");
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      if (!res.ok) return { valid: false, error: `Anthropic API error: ${res.status}` };
      const body = (await res.json()) as { data?: { id: string }[] };
      const models: ModelInfo[] = (body.data ?? [])
        .filter((m) => m.id.startsWith("claude"))
        .map((m) => ({ id: m.id, provider: "anthropic" }));
      return { valid: true, models };
    } catch (err) {
      if (err instanceof ProviderRequestError) return { valid: false, error: err.message };
      return {
        valid: false,
        error: `Anthropic connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await this.apiFetch("/models");
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id, provider: "anthropic" }));
    } catch {
      return [];
    }
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const messages = input.messages.map((m) => ({ role: m.role, content: m.content }));

    const res = await this.apiFetch("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        system: input.systemPrompt,
        messages,
        max_tokens: input.maxTokens ?? 2048,
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      const errMsg =
        typeof errBody?.error === "object" && errBody.error !== null
          ? ((errBody.error as Record<string, unknown>)?.message ?? String(errBody.error))
          : String(errBody);
      throw new ProviderRequestError(
        "anthropic",
        res.status,
        typeof errMsg === "string" ? errMsg : `Anthropic API error: ${res.status}`,
      );
    }

    const body = (await res.json()) as {
      content?: { text?: string }[];
      usage?: { input_tokens: number; output_tokens: number };
      model?: string;
      stop_reason?: string;
    };

    const text = (body.content ?? []).map((c) => c.text ?? "").join("");

    return {
      content: text,
      model: body.model ?? input.model,
      usage: {
        promptTokens: body.usage?.input_tokens ?? 0,
        completionTokens: body.usage?.output_tokens ?? 0,
        totalTokens: (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0),
      },
      finishReason: body.stop_reason ?? "stop",
    };
  }
}
