export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerationInput {
  model: string;
  systemPrompt?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerationResult {
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
}

export interface ValidationResult {
  valid: boolean;
  models?: ModelInfo[];
  error?: string;
}

export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export class ProviderRequestError extends Error implements ProviderError {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly statusCode?: number;
  public readonly providerName: string;

  constructor(provider: string, statusCode: number, message: string) {
    super(message);
    this.name = "ProviderRequestError";
    this.code = `PROVIDER_${statusCode}`;
    this.retryable = statusCode >= 500 || statusCode === 429;
    this.statusCode = statusCode;
    this.providerName = provider;
  }
}

export interface AIProvider {
  readonly provider: string;
  validate(): Promise<ValidationResult>;
  listModels(): Promise<ModelInfo[]>;
  generate(input: GenerationInput): Promise<GenerationResult>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  if (timeout === 0) {
    return fetch(url, { ...options });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
