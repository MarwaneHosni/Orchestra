const BASE = "http://localhost:3000";

export interface CreateProjectResult {
  projectId: string;
  sessionId: string;
}

export interface QuestionPayload {
  id: string;
  phaseType: string;
  order: number;
  text: string;
  type: "text" | "select" | "multi_select" | "boolean" | "scale";
  options: string[];
  required: boolean;
  validation: { minLength?: number; maxLength?: number } | null;
  helpText: string | null;
}

export interface NextQuestionResult {
  question: QuestionPayload | null;
  phaseIndex: number;
  questionIndex: number;
  phaseName: string;
  total: number;
  answered: number;
}

export interface BlueprintResult {
  projectId: string;
  sessionId: string;
  planVersion: number;
  generatedAt: string;
  projectName: string;
  projectDescription: string;
  phases: {
    phaseType: string;
    phaseName: string;
    summary: string;
    status: "sufficient" | "insufficient" | "missing";
    confidence: number;
    ambiguityFlags: { type: string; message: string; severity: string }[];
  }[];
  assumptions: { description: string; source: string }[];
  constraints: { description: string; source: string }[];
  risks: { description: string; source: string }[];
  overallConfidence: number;
  ambiguityFlags: { type: string; message: string; severity: string }[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function createProject(ideaText: string, projectName?: string): Promise<CreateProjectResult> {
  return request<CreateProjectResult>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ ideaText, projectName }),
  });
}

export async function startInterview(sessionId: string): Promise<{ sessionId: string; status: string }> {
  return request(`/api/v1/interviews/${sessionId}/start`, { method: "POST", body: "{}" });
}

export interface ResumeResult {
  session: { id: string; status: string; currentPhaseIndex: number; currentQuestionIndex: number };
  answers: { id: string; questionId: string; value: string; version: number }[];
  next: QuestionPayload | null;
}

export async function resumeSession(sessionId: string): Promise<ResumeResult> {
  return request(`/api/v1/interviews/${sessionId}/resume`);
}

export async function getSessionAnswers(
  sessionId: string,
): Promise<{ data: { questionId: string; value: string }[] }> {
  return request(`/api/v1/interviews/${sessionId}/answers`);
}

export async function getNextQuestion(sessionId: string): Promise<NextQuestionResult> {
  return request(`/api/v1/interviews/${sessionId}/next`);
}

export async function submitAnswer(
  sessionId: string,
  questionId: string,
  value: string,
  confidence?: string,
): Promise<{ answer: { id: string }; next: QuestionPayload | null; edited: boolean }> {
  return request(`/api/v1/interviews/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, value, confidence }),
  });
}

export async function transitionSession(
  sessionId: string,
  toStatus: string,
): Promise<{ sessionId: string; status: string }> {
  return request(`/api/v1/interviews/${sessionId}/transition`, {
    method: "POST",
    body: JSON.stringify({ toStatus }),
  });
}

export async function generateBlueprint(sessionId: string): Promise<BlueprintResult> {
  return request(`/api/v1/interviews/${sessionId}/generate`, { method: "POST", body: "{}" });
}

// ── Versioning / Snapshots ────────────────────────────────────────────

export interface SnapshotInfo {
  id: string;
  projectId: string;
  version: number;
  parentSnapshotId: string | null;
  reason: string;
  status: "complete" | "failed";
  planId: string | null;
  planVersion: number | null;
  blueprintId: string | null;
  taskGraphId: string | null;
  interviewSessionId: string | null;
  answerCount: number;
  affectedPhaseTypes: string[] | null;
  changeSummary: string | null;
  failureReason: string | null;
  createdAt: string;
}

export async function getSnapshots(projectId: string): Promise<{ data: SnapshotInfo[] }> {
  return request(`/api/v1/projects/${projectId}/snapshots`);
}

export interface DiffSummary {
  regenerationScope: "full" | "partial" | "none";
  affectedPhaseTypes: string[];
  phaseChanges: number;
  taskChanges: number;
  promptChanges: number;
  blueprintChanges: number;
}

export interface TaskDiff {
  phaseType: string;
  order: number;
  changeType: "added" | "removed" | "modified" | "unchanged";
  left: { title: string; type: string; status: string; depCount: number } | null;
  right: { title: string; type: string; status: string; depCount: number } | null;
}

export interface PromptDiff {
  phaseType: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  textChanged: boolean;
  statusChanged: boolean;
}

export interface BlueprintItemDiff {
  changeType: "added" | "removed" | "modified" | "unchanged";
  description: string;
}

export interface PhaseSummaryDiff {
  phaseType: string;
  summaryChanged: boolean;
  confidenceChanged: boolean;
  statusChanged: boolean;
  leftSummary: string | null;
  rightSummary: string | null;
}

export interface BlueprintDiff {
  assumptions: BlueprintItemDiff[];
  constraints: BlueprintItemDiff[];
  risks: BlueprintItemDiff[];
  phaseSummaries: PhaseSummaryDiff[];
}

export interface VersionDiff {
  left: { version: number; reason: string; planVersion: number | null; createdAt: string };
  right: { version: number; reason: string; planVersion: number | null; createdAt: string };
  summary: DiffSummary;
  tasks: TaskDiff[];
  prompts: PromptDiff[];
  blueprint: BlueprintDiff | null;
}

export async function getSnapshotDiff(leftSnapshotId: string, rightSnapshotId: string): Promise<VersionDiff> {
  return request(`/api/v1/snapshots/${leftSnapshotId}/compare/${rightSnapshotId}`);
}

// ── Exports ───────────────────────────────────────────────────────────

export interface ExportRecord {
  id: string;
  snapshotId: string;
  projectId: string;
  format: "markdown" | "json";
  type: "blueprint" | "task_graph" | "prompts" | "full_bundle";
  content: string;
  bundleVersion: string;
  snapshotVersion: number;
  planVersion: number | null;
  sourceReason: string;
  createdAt: string;
}

export async function exportArtifact(
  snapshotId: string,
  type: ExportRecord["type"],
  format: ExportRecord["format"],
  blueprintContent?: Record<string, unknown> | null,
): Promise<ExportRecord> {
  return request(`/api/v1/snapshots/${snapshotId}/export`, {
    method: "POST",
    body: JSON.stringify({ type, format, blueprintContent }),
  });
}

export async function getExports(snapshotId: string): Promise<{ data: ExportRecord[] }> {
  return request(`/api/v1/snapshots/${snapshotId}/exports`);
}

export async function getExportContent(exportId: string): Promise<ExportRecord> {
  return request(`/api/v1/exports/${exportId}`);
}

function triggerDownload(content: string, filename: string, format: string) {
  const mimeType = format === "json" ? "application/json" : "text/markdown";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { triggerDownload };

// ── Provider Credentials ──────────────────────────────────────────────

export interface ProviderCredential {
  id: string;
  userId: string;
  provider: string;
  displayName: string;
  status: "unverified" | "valid" | "invalid" | "expired";
  defaultModel: string | null;
  modelsAvailable: string | null;
  lastVerifiedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export async function listCredentials(): Promise<{ data: ProviderCredential[] }> {
  return request("/api/v1/provider-credentials");
}

export async function createCredential(input: {
  provider: string;
  apiKey: string;
  displayName?: string;
  defaultModel?: string;
}): Promise<ProviderCredential> {
  return request("/api/v1/provider-credentials", {
    method: "POST",
    body: JSON.stringify({ ...input, userId: "00000000-0000-0000-0000-000000000001" }),
  });
}

export async function deleteCredential(id: string): Promise<void> {
  await fetch(`http://localhost:3000/api/v1/provider-credentials/${id}`, { method: "DELETE" });
}

export async function validateCredential(id: string): Promise<ProviderCredential> {
  return request(`/api/v1/provider-credentials/${id}/validate`, { method: "POST", body: "{}" });
}
