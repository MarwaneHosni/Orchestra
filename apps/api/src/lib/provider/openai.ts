import type { AIProvider, GenerationInput, GenerationResult, ModelInfo, ValidationResult } from "./types.js";
import { ProviderRequestError, fetchWithTimeout } from "./types.js";

const BASE_URL = "https://api.openai.com/v1";

export class OpenAIProvider implements AIProvider {
  readonly provider = "openai";

  constructor(private apiKey: string) {}

  private async apiFetch(path: string, options?: RequestInit): Promise<Response> {
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
      if (!res.ok) return { valid: false, error: `OpenAI API error: ${res.status}` };
      const body = (await res.json()) as { data?: { id: string }[] };
      const models: ModelInfo[] = (body.data ?? [])
        .filter((m) => m.id.startsWith("gpt"))
        .map((m) => ({ id: m.id, provider: "openai" }));
      return { valid: true, models };
    } catch (err) {
      if (err instanceof ProviderRequestError) {
        return { valid: false, error: err.message };
      }
      return {
        valid: false,
        error: `OpenAI connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await this.apiFetch("/models");
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id, provider: "openai" }));
    } catch {
      return [];
    }
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    const messages: { role: string; content: string }[] = [];
    if (input.systemPrompt) messages.push({ role: "system", content: input.systemPrompt });
    messages.push(...input.messages);

    const res = await this.apiFetch("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      const errMsg =
        typeof errBody?.error === "object" && errBody.error !== null
          ? ((errBody.error as Record<string, unknown>)?.message ?? String(errBody.error))
          : String(errBody);
      throw new ProviderRequestError(
        "openai",
        res.status,
        typeof errMsg === "string" ? errMsg : `OpenAI API error: ${res.status}`,
      );
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?: string;
    };

    return {
      content: body.choices?.[0]?.message?.content ?? "",
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
