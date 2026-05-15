const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,
  /sk-ant-[A-Za-z0-9-]{20,}/g,
  /sk-or-[A-Za-z0-9]{20,}/g,
  /[A-Za-z0-9+/]{40,}={0,2}/g,
];

const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "secretkey",
  "secret_key",
  "password",
  "token",
  "accesstoken",
  "access_token",
  "authorization",
  "x-api-key",
]);

const SENSITIVE_HEADERS = new Set(["authorization", "x-api-key", "cookie", "set-cookie"]);

export function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower)) return "[REDACTED]";
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(value)) return "[REDACTED]";
    }
  }
  return value;
}

export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return result;
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "[REDACTED]";
    if (parsed.username) parsed.username = "[REDACTED]";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function truncateBody(body: string, maxLength: number = 500): string {
  return body.length > maxLength ? body.slice(0, maxLength) + "..." : body;
}

export function sanitizeProviderResponse(response: unknown): unknown {
  if (typeof response !== "object" || response === null) return response;
  const obj = response as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "content" && typeof value === "string") {
      sanitized[key] = truncateBody(value);
    } else if (key === "result_text" || key === "prompt_text") {
      sanitized[key] = truncateBody(typeof value === "string" ? value : String(value));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
