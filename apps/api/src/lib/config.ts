import { z } from "zod";
import { createModuleLogger } from "./logging/logger.js";

const log = createModuleLogger("config");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url().optional(),
  SQLITE_DB_PATH: z.string().default("./orchestra.db"),
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function loadConfig(): Env {
  if (_config) return _config;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    log.error({ issues: result.error.issues }, "invalid_environment_config");
    process.exit(1);
  }
  _config = result.data;
  return _config;
}
