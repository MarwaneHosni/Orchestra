import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const logLevel = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

let _logger: pino.Logger | null = null;

export function getBaseLogger(): pino.Logger {
  if (_logger) return _logger;

  _logger = pino({
    level: logLevel,
    redact: {
      paths: [
        "apiKey", "api_key", "encryptedApiKey", "encrypted_api_key",
        "secret", "password", "token", "authorization",
        "req.headers.authorization", "req.headers.cookie",
        "key", "privateKey", "accessToken",
      ],
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
      },
    }),
  });

  return _logger;
}

export function createModuleLogger(module: string): pino.Logger {
  return getBaseLogger().child({ module });
}

export function resetLogger(): void {
  _logger = null;
}

export { pino };
