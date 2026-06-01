import { getDb } from "./index.js";
import { createModuleLogger } from "../../lib/logging/logger.js";

const log = createModuleLogger("db");

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  raw_description TEXT NOT NULL,
  refined_description TEXT,
  status TEXT NOT NULL DEFAULT 'raw',
  provenance TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase_index INTEGER NOT NULL DEFAULT 0,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  phase_type TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT,
  required INTEGER NOT NULL DEFAULT 0,
  dependency_rules TEXT,
  validation_rules TEXT,
  capture_as TEXT,
  help_text TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id),
  value TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  provenance TEXT NOT NULL DEFAULT 'user',
  version INTEGER NOT NULL DEFAULT 1,
  is_latest INTEGER NOT NULL DEFAULT 1,
  superseded_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating',
  stale_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blueprints (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'json',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'generating',
  stale_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified',
  encrypted_api_key TEXT,
  key_reference TEXT,
  default_model TEXT,
  models_available TEXT,
  last_verified_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_graphs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  plan_version INTEGER NOT NULL,
  graph_version INTEGER NOT NULL DEFAULT 1,
  derived_from_graph_id TEXT,
  status TEXT NOT NULL DEFAULT 'generating',
  task_count INTEGER NOT NULL DEFAULT 0,
  dependency_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_tasks (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  phase_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  "order" INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  superseded_by_task_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES execution_tasks(id),
  depends_on_task_id TEXT NOT NULL REFERENCES execution_tasks(id),
  dependency_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  plan_id TEXT NOT NULL DEFAULT '',
  plan_version INTEGER NOT NULL DEFAULT 0,
  prompt_text TEXT NOT NULL,
  sections_json TEXT,
  result_text TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_type TEXT,
  provider TEXT,
  model TEXT,
  estimated_prompt_tokens INTEGER,
  estimated_completion_tokens INTEGER,
  estimated_cost REAL,
  actual_prompt_tokens INTEGER,
  actual_completion_tokens INTEGER,
  actual_total_tokens INTEGER,
  actual_cost REAL,
  status TEXT NOT NULL DEFAULT 'estimated',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  event_type TEXT NOT NULL,
  actor_id TEXT,
  resource_id TEXT,
  description TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  phase_type TEXT NOT NULL,
  input_status TEXT NOT NULL,
  answer_count INTEGER NOT NULL DEFAULT 0,
  required_count INTEGER NOT NULL DEFAULT 0,
  inferred_requirements TEXT,
  likely_constraints TEXT,
  explicit_assumptions TEXT,
  identified_risks TEXT,
  key_decisions TEXT,
  uncertainty_areas TEXT,
  cross_phase_insights TEXT,
  overall_confidence REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'running',
  synthesis_status TEXT NOT NULL DEFAULT 'pending',
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  blueprint_status TEXT NOT NULL DEFAULT 'pending',
  roadmap_status TEXT NOT NULL DEFAULT 'pending',
  task_graph_status TEXT NOT NULL DEFAULT 'pending',
  prompt_gen_status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  model TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_cache_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
  prompt_version INTEGER NOT NULL DEFAULT 0,
  schema_version TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.7,
  system_prompt_hash TEXT NOT NULL,
  messages_hash TEXT NOT NULL,
  response_content TEXT NOT NULL,
  response_model TEXT NOT NULL,
  finish_reason TEXT NOT NULL DEFAULT 'stop',
  usage_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  usage_completion_tokens INTEGER NOT NULL DEFAULT 0,
  usage_total_tokens INTEGER NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_model ON ai_cache_entries(model);
CREATE INDEX IF NOT EXISTS idx_ai_cache_provider ON ai_cache_entries(provider);
CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_cache_entries(created_at);

CREATE TABLE IF NOT EXISTS ai_cache_invalidation_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marker_key TEXT NOT NULL UNIQUE,
  prompt_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function createTables(): void {
  const db = getDb();
  // Execute each statement separately (sql.js doesn't support multi-statement exec)
  const statements = CREATE_TABLES_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      db.run(stmt);
    } catch (err) {
      log.warn({ err: (err as Error).message }, "table_creation_warning");
    }
  }
}
