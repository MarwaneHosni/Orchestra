import type { AnswerRecord } from "../orchestration/types.js";
import type { BlueprintOutput } from "../contract/output-schema.js";
import type { Roadmap, TaskDraft } from "../roadmap/types.js";
import type { PromptBundle } from "../prompt/prompt-bundle-types.js";
import {
  createInMemoryAnswerStore,
  createInMemoryArtifactStore,
  createInMemoryGenerationRunStore,
} from "./stores.js";
import type {
  AnswerStore,
  AnswerSnapshot,
  ArtifactStore,
  ArtifactRecord,
  GenerationRunStore,
  GenerationRunRecord,
  ArtifactType,
  GenerationPackage,
} from "./types.js";

export interface GenerationInput {
  projectId: string;
  sessionId: string;
  model: string;
  provider: string;
  modelTier: string;
  fallbackUsed: boolean;
  routerDecision: string | null;
  answers: AnswerRecord[];
  blueprint?: BlueprintOutput | null;
  roadmap?: Roadmap | null;
  taskDraft?: TaskDraft | null;
  promptBundle?: PromptBundle | null;
  generationVersion?: number;
}

export class PersistenceService {
  readonly answers: AnswerStore;
  readonly artifacts: ArtifactStore;
  readonly generations: GenerationRunStore;

  constructor() {
    this.answers = createInMemoryAnswerStore();
    this.artifacts = createInMemoryArtifactStore();
    this.generations = createInMemoryGenerationRunStore();
  }

  persistGeneration(input: GenerationInput): GenerationPackage {
    const startedAt = new Date().toISOString();
    const genVersion = input.generationVersion ?? this.getNextGenerationVersion(input.projectId);
    const generationRunId = crypto.randomUUID();

    // 1. Capture answer snapshot (raw answers, separate from generated content)
    const answerSnapshot = this.answers.captureSnapshot(input.projectId, input.sessionId, input.answers);

    // 2. Save each generated artifact with lineage (now includes all IDs)
    const savedBlueprint = input.blueprint
      ? this.saveArtifact(
          input,
          "blueprint",
          input.blueprint,
          genVersion,
          generationRunId,
          answerSnapshot.snapshotId,
        )
      : undefined;
    const savedRoadmap = input.roadmap
      ? this.saveArtifact(
          input,
          "roadmap",
          input.roadmap,
          genVersion,
          generationRunId,
          answerSnapshot.snapshotId,
        )
      : undefined;
    const savedTaskDraft = input.taskDraft
      ? this.saveArtifact(
          input,
          "task_graph",
          input.taskDraft,
          genVersion,
          generationRunId,
          answerSnapshot.snapshotId,
        )
      : undefined;
    const savedPromptBundle = input.promptBundle
      ? this.saveArtifact(
          input,
          "prompt_bundle",
          input.promptBundle,
          genVersion,
          generationRunId,
          answerSnapshot.snapshotId,
        )
      : undefined;

    const artifacts: { type: ArtifactType; artifactId: string }[] = [];
    if (savedBlueprint) artifacts.push({ type: "blueprint", artifactId: savedBlueprint.id });
    if (savedRoadmap) artifacts.push({ type: "roadmap", artifactId: savedRoadmap.id });
    if (savedTaskDraft) artifacts.push({ type: "task_graph", artifactId: savedTaskDraft.id });
    if (savedPromptBundle) artifacts.push({ type: "prompt_bundle", artifactId: savedPromptBundle.id });

    // 3. Record the generation run
    const completedAt = new Date().toISOString();
    const run: GenerationRunRecord = {
      id: generationRunId,
      projectId: input.projectId,
      sessionId: input.sessionId,
      sourceAnswerSnapshotId: answerSnapshot.snapshotId,
      model: input.model,
      provider: input.provider,
      modelTier: input.modelTier,
      generationVersion: genVersion,
      startedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      artifacts,
      fallbackUsed: input.fallbackUsed,
      routerDecision: input.routerDecision,
    };
    this.generations.save(run);

    return {
      run,
      answerSnapshot,
      blueprint: savedBlueprint,
      roadmap: savedRoadmap,
      taskDraft: savedTaskDraft,
      promptBundle: savedPromptBundle,
    };
  }

  getGenerationPackage(generationRunId: string): GenerationPackage | undefined {
    const run = this.generations.get(generationRunId);
    if (!run) return undefined;

    const answerSnapshot = this.answers.getSnapshot(run.sourceAnswerSnapshotId);
    if (!answerSnapshot) return undefined;

    const blueprint = run.artifacts.find((a) => a.type === "blueprint");
    const roadmap = run.artifacts.find((a) => a.type === "roadmap");
    const taskDraft = run.artifacts.find((a) => a.type === "task_graph");
    const promptBundle = run.artifacts.find((a) => a.type === "prompt_bundle");

    return {
      run,
      answerSnapshot,
      blueprint: blueprint ? this.artifacts.get(blueprint.artifactId) : undefined,
      roadmap: roadmap ? this.artifacts.get(roadmap.artifactId) : undefined,
      taskDraft: taskDraft ? this.artifacts.get(taskDraft.artifactId) : undefined,
      promptBundle: promptBundle ? this.artifacts.get(promptBundle.artifactId) : undefined,
    };
  }

  getGenerationRuns(projectId: string): GenerationRunRecord[] {
    return this.generations.getByProject(projectId);
  }

  listAnswerVersions(projectId: string): AnswerSnapshot[] {
    return this.answers.getSnapshotsBySession(projectId);
  }

  listArtifactVersions(projectId: string, type: ArtifactType): ArtifactRecord[] {
    return this.artifacts.getAllVersions(projectId, type);
  }

  compareArtifactVersions(
    projectId: string,
    type: ArtifactType,
    versionA: number,
    versionB: number,
  ): { left: ArtifactRecord | undefined; right: ArtifactRecord | undefined } {
    return {
      left: this.artifacts.getByTypeAndVersion(projectId, type, versionA),
      right: this.artifacts.getByTypeAndVersion(projectId, type, versionB),
    };
  }

  getLatestArtifact(projectId: string, type: ArtifactType): ArtifactRecord | undefined {
    const versions = this.artifacts.getAllVersions(projectId, type);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  private saveArtifact<T>(
    input: GenerationInput,
    type: ArtifactType,
    content: T,
    generationVersion: number,
    generationRunId: string,
    sourceAnswerSnapshotId: string,
  ): ArtifactRecord | undefined {
    if (!content) return undefined;
    const existingVersions = this.artifacts.getAllVersions(input.projectId, type);
    const version = existingVersions.length + 1;

    const record: ArtifactRecord = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      generationRunId,
      type,
      content: JSON.stringify(content),
      version,
      createdAt: new Date().toISOString(),
      lineage: {
        generationRunId,
        sourceAnswerSnapshotId,
        generationVersion,
        model: input.model,
        provider: input.provider,
        sourceSessionId: input.sessionId,
      },
    };
    this.artifacts.save(record);
    return record;
  }

  private getNextGenerationVersion(projectId: string): number {
    const runs = this.generations.getByProject(projectId);
    return runs.length > 0 ? Math.max(...runs.map((r) => r.generationVersion)) + 1 : 1;
  }
}
