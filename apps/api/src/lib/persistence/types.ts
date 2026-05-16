// ─────────────────────────────────────────────────────────────
// Answer snapshot — immutable record of raw answers at a point in time
// ─────────────────────────────────────────────────────────────

export interface AnswerRecord {
  id: string;
  questionId: string;
  projectId: string;
  sessionId: string;
  value: string;
  confidence: string;
  provenance: string;
  version: number;
  isLatest: boolean;
  createdAt: string;
  supersededAt: string | null;
}

export interface AnswerSnapshot {
  snapshotId: string;
  projectId: string;
  sessionId: string;
  answers: AnswerRecord[];
  capturedAt: string;
  answerCount: number;
  version: number;
}

export interface AnswerStore {
  captureSnapshot(projectId: string, sessionId: string, answers: AnswerRecord[]): AnswerSnapshot;
  getSnapshot(snapshotId: string): AnswerSnapshot | undefined;
  getSnapshotsBySession(sessionId: string): AnswerSnapshot[];
  getLatestAnswerVersion(projectId: string): AnswerSnapshot | undefined;
}

// ─────────────────────────────────────────────────────────────
// Generation run — metadata for one AI generation pass
// ─────────────────────────────────────────────────────────────

export type ArtifactType = "blueprint" | "roadmap" | "task_graph" | "prompt_bundle";

export interface GenerationRunRecord {
  id: string;
  projectId: string;
  sessionId: string;
  sourceAnswerSnapshotId: string;
  model: string;
  provider: string;
  modelTier: string;
  generationVersion: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  artifacts: { type: ArtifactType; artifactId: string }[];
  fallbackUsed: boolean;
  routerDecision: string | null;
}

export interface ArtifactRecord {
  id: string;
  projectId: string;
  generationRunId: string;
  type: ArtifactType;
  content: string;
  version: number;
  createdAt: string;
  lineage: ArtifactLineage;
}

export interface ArtifactLineage {
  generationRunId: string;
  sourceAnswerSnapshotId: string;
  generationVersion: number;
  model: string;
  provider: string;
  sourceSessionId: string;
}

export interface ArtifactStore {
  save(record: ArtifactRecord): void;
  get(id: string): ArtifactRecord | undefined;
  getByProject(projectId: string): ArtifactRecord[];
  getByTypeAndVersion(projectId: string, type: ArtifactType, version: number): ArtifactRecord | undefined;
  getAllVersions(projectId: string, type: ArtifactType): ArtifactRecord[];
}

// ─────────────────────────────────────────────────────────────
// Generation record store
// ─────────────────────────────────────────────────────────────

export interface GenerationRunStore {
  save(record: GenerationRunRecord): void;
  get(id: string): GenerationRunRecord | undefined;
  getByProject(projectId: string): GenerationRunRecord[];
}

// ─────────────────────────────────────────────────────────────
// Full generation package — all artifacts from one generation run
// ─────────────────────────────────────────────────────────────

export interface GenerationPackage {
  run: GenerationRunRecord;
  answerSnapshot: AnswerSnapshot;
  blueprint?: ArtifactRecord | undefined;
  roadmap?: ArtifactRecord | undefined;
  taskDraft?: ArtifactRecord | undefined;
  promptBundle?: ArtifactRecord | undefined;
}
