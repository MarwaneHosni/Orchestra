import { getApiBaseUrl } from "./api-config";

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
  category?: string;
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
  projectSummary?: {
    projectOverview: string;
    keyFeatures: string[];
    technicalConstraints: string[];
    businessConditions: string[];
    architectureHighlights: string[];
    riskSummary: string;
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const method = options?.method ?? "GET";
  console.log(`[DEBUG] API request ${method} ${url}`);
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log(`[DEBUG] API error ${res.status} on ${path}:`, JSON.stringify(body));
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  const data = await res.json() as T;
  console.log(`[DEBUG] API success ${method} ${url} -> 200`);
  return data;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export async function listProjects(page = 1, pageSize = 20): Promise<PaginatedResponse<ProjectRecord>> {
  return request<PaginatedResponse<ProjectRecord>>(`/api/v1/projects?page=${page}&pageSize=${pageSize}`);
}

export async function createProject(ideaText: string, projectName?: string): Promise<CreateProjectResult> {
  return request<CreateProjectResult>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ ideaText, projectName }),
  });
}

export async function createOrResumeSession(
  projectId: string,
): Promise<{ sessionId: string; status: string }> {
  return request<{ sessionId: string; status: string }>(`/api/v1/projects/${projectId}/interviews`, {
    method: "POST",
    body: JSON.stringify({}),
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

export async function generateBlueprint(sessionId: string, workflowId?: string): Promise<BlueprintResult> {
  return request(`/api/v1/interviews/${sessionId}/generate`, {
    method: "POST",
    body: JSON.stringify({ workflowId }),
  });
}

export async function getLatestBlueprint(sessionId: string): Promise<BlueprintResult | null> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/interviews/${sessionId}/blueprint`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch blueprint: ${res.status}`);
  return res.json() as Promise<BlueprintResult>;
}

export async function updateTaskStatus(
  planId: string,
  taskId: string,
  status: string,
): Promise<{ id: string; status: string }> {
  return request(`/api/v1/plans/${planId}/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function cancelGeneration(workflowId: string): Promise<void> {
  await request(`/api/v1/progress/${workflowId}/cancel`, { method: "POST" });
}

// ── Activity / Timeline ───────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  eventType: string;
  timestamp: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
}

export interface ProjectSummary {
  totalEvents: number;
  exportCount: number;
  compareCount: number;
  failedCount: number;
}

export async function getProjectActivity(projectId: string): Promise<{ data: ActivityEvent[] }> {
  return request(`/api/v1/projects/${projectId}/activity`);
}

export async function getProjectSummary(projectId: string): Promise<ProjectSummary> {
  return request(`/api/v1/projects/${projectId}/summary`);
}

const EVENT_LABELS: Record<string, string> = {
  "snapshot.created": "Snapshot created",
  "snapshot.failed": "Snapshot failed",
  "snapshot.regenerated": "Plan regenerated",
  "snapshot.partial_regenerated": "Partial regeneration",
  "export.generated": "Artifact exported",
  "export.redownloaded": "Prior export re-downloaded",
  "compare.viewed": "Versions compared",
  "generation.attempted": "Generation started",
  "generation.completed": "Generation completed",
  "generation.failed": "Generation failed",
  "project.created": "Project created",
  "project.updated": "Project updated",
};

export function getEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

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
    body: JSON.stringify(input),
  });
}

export async function deleteCredential(id: string): Promise<void> {
  await fetch(`${getApiBaseUrl()}/api/v1/provider-credentials/${id}`, { method: "DELETE" });
}

export async function validateCredential(id: string): Promise<ProviderCredential> {
  return request(`/api/v1/provider-credentials/${id}/validate`, { method: "POST", body: "{}" });
}
