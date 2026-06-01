import { z } from "zod";
import { PHASE_ORDER } from "../interview/questions.js";
import { transitionState } from "../interview/flow.js";
import type { InterviewState } from "../interview/flow.js";
import { BlueprintGenerator } from "../blueprint/generator.js";
import { normalizeText } from "../blueprint/normalizer.js";
import { logAudit } from "../audit/logger.js";
import { FailureSpikeDetector } from "../audit/failure-tracker.js";
import { instrumentGenerationFunnel, instrumentInterviewProgress } from "../metrics/index.js";
import type { AnswerRecord, CreateProjectInput, SessionRecord, PlanRecord } from "./types.js";
import type { SessionStore } from "./store.js";
import type { InterviewMode } from "../interview/types.js";
import { getNextQuestion, getRefinementQuestions } from "../interview/adaptive-engine.js";
import { createModuleLogger } from "../logging/logger.js";
import { NotFoundError, ValidationError } from "../errors.js";

const orchLog = createModuleLogger("orchestration");

export const CreateProjectSchema = z.object({
  ideaText: z.string().min(10, "Idea description must be at least 10 characters").max(5000),
  projectName: z.string().min(1).max(200).optional(),
});

export const SubmitAnswerSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  value: z.string().min(0),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const TransitionSchema = z.object({
  toStatus: z.enum(["draft", "in_progress", "waiting_for_answers", "ready_for_generation", "refining", "completed"]),
});

export class OrchestrationService {
  constructor(private store: SessionStore) {}

  private spikeDetector = new FailureSpikeDetector();

  private log(step: string, meta?: Record<string, unknown>) {
    orchLog.info(meta ?? {}, step);
  }

  createProject(input: CreateProjectInput, mode: InterviewMode = "quick"): { projectId: string; sessionId: string } {
    const projectId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const name =
      input.projectName ??
      input.ideaText.slice(0, 60).replace(/\n/g, " ") + (input.ideaText.length > 60 ? "..." : "");

    this.log("project.created", { projectId, sessionId, mode });

    if (mode === "quick") {
      instrumentInterviewProgress("quick_mode_used");
    } else {
      instrumentInterviewProgress("advanced_mode_used");
    }
    instrumentInterviewProgress("start");

    this.store.insertProject({
      id: projectId,
      name,
      description: input.ideaText,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    this.store.insertIdea({
      id: crypto.randomUUID(),
      projectId,
      rawDescription: input.ideaText,
      refinedDescription: null,
      status: "raw",
      provenance: "user",
      createdAt: now,
      updatedAt: now,
    });

    this.store.insertSession({
      id: sessionId,
      projectId,
      status: "draft",
      currentPhaseIndex: 0,
      currentQuestionIndex: 0,
      mode,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return { projectId, sessionId };
  }

  startSession(sessionId: string): SessionRecord {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);

    if (session.status === "in_progress" || session.status === "waiting_for_answers") {
      return session;
    }

    const state = this.toState(session);
    const updated = transitionState(state, "in_progress");
    this.store.updateSession(sessionId, {
      status: updated.status,
      startedAt: updated.startedAt?.toISOString() ?? null,
    });

    return { ...session, status: updated.status, startedAt: updated.startedAt?.toISOString() ?? null };
  }

  getNextQuestion(sessionId: string): {
    question: object | null;
    phaseIndex: number;
    questionIndex: number;
    phaseName: string;
    total: number;
    answered: number;
  } {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);
    if (session.status === "completed" || session.status === "ready_for_generation" || session.status === "refining") {
      const latest = this.store.getLatestAnswersBySession(sessionId);
      const answeredIds = new Set(latest.map((a) => a.questionId));
      const mode = (session as any).mode ?? "quick";

      if (session.status === "refining") {
        const refinementQuestions = getRefinementQuestions(latest, answeredIds);
        return {
          question: null,
          phaseIndex: 0,
          questionIndex: 0,
          phaseName: "",
          total: refinementQuestions.length,
          answered: answeredIds.size,
        };
      }

      const adaptiveResult = getNextQuestion({ mode, answeredIds, answers: latest });
      return {
        question: null,
        phaseIndex: 0,
        questionIndex: 0,
        phaseName: "",
        total: adaptiveResult.eligibleCount,
        answered: adaptiveResult.answeredCount,
      };
    }

    const latest = this.store.getLatestAnswersBySession(sessionId);
    const state = this.toState(session);
    const answeredIds = new Set(latest.map((a) => a.questionId));
    const mode = (session as any).mode ?? "quick";

    const adaptiveResult = getNextQuestion({ mode, answeredIds, answers: latest });
    const totalQuestions = adaptiveResult.eligibleCount;
    const nextQuestion = adaptiveResult.nextQuestion;

    if (!nextQuestion) {
      this.log("session.ready_for_generation", {
        sessionId,
        total: totalQuestions,
        answered: answeredIds.size,
      });
      const updated = transitionState(state, "ready_for_generation");
      this.store.updateSession(sessionId, { status: updated.status });
      return {
        question: null,
        phaseIndex: 0,
        questionIndex: 0,
        phaseName: "",
        total: totalQuestions,
        answered: answeredIds.size,
      };
    }

    const questionRef = `${nextQuestion.phaseType}.${nextQuestion.order}`;
    this.log("question.served", {
      sessionId,
      questionRef,
      answered: answeredIds.size,
      total: totalQuestions,
    });
    return {
      question: {
        id: questionRef,
        phaseType: nextQuestion.phaseType,
        order: nextQuestion.order,
        text: nextQuestion.text,
        type: nextQuestion.type,
        options: nextQuestion.options ?? [],
        required: nextQuestion.required,
        category: nextQuestion.category,
        validation: nextQuestion.validation ?? null,
        helpText: nextQuestion.helpText ?? null,
      },
      phaseIndex: state.currentPhaseIndex,
      questionIndex: state.currentQuestionIndex,
      phaseName: PHASE_ORDER[state.currentPhaseIndex] ?? "",
      total: totalQuestions,
      answered: answeredIds.size,
    };
  }

  submitAnswer(
    sessionId: string,
    questionId: string,
    value: string,
    confidence?: string,
  ): { answer: AnswerRecord; next: object | null; edited: boolean } {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);
    if (session.status === "completed") {
      throw new ValidationError("Session is no longer accepting answers");
    }

    const state = this.toState(session);
    if (state.status === "waiting_for_answers" || state.status === "ready_for_generation" || state.status === "refining") {
      const updated = transitionState(state, "in_progress");
      this.store.updateSession(sessionId, { status: updated.status });
    }

    const existing = this.store.getLatestAnswersBySession(sessionId).find((a) => a.questionId === questionId);
    const isEdit = !!existing;
    const nextVersion = existing ? existing.version + 1 : 1;

    if (isEdit) {
      this.store.supersedeAnswer(sessionId, questionId);
      this.store.markPlansStaleBySession(sessionId);
      this.store.markBlueprintsStaleBySession(sessionId);
    }

    const normalized = normalizeText(value);
    const changed = isEdit && normalized !== existing?.value;
    const isSkipped = normalized.length === 0;
    this.log("answer.submitted", { sessionId, questionId, isEdit, changed, length: normalized.length, skipped: isSkipped });

    if (isSkipped) {
      instrumentInterviewProgress("question_skipped");
    } else {
      instrumentInterviewProgress("question_answered");
    }

    const answer: AnswerRecord = {
      id: crypto.randomUUID(),
      questionId,
      projectId: session.projectId,
      sessionId,
      value: normalized,
      confidence: confidence ?? "high",
      provenance: "user",
      version: nextVersion,
      isLatest: true,
      createdAt: new Date().toISOString(),
      supersededAt: null,
    };

    this.store.insertAnswer(answer);

    const next = this.getNextQuestion(sessionId);
    return { answer, next: next.question, edited: isEdit };
  }

  resumeSession(sessionId: string): {
    session: SessionRecord;
    answers: AnswerRecord[];
    next: object | null;
  } {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);

    const answers = this.store.getLatestAnswersBySession(sessionId);
    const next = this.getNextQuestion(sessionId);

    return { session, answers, next: next.question };
  }

  getSessionAnswers(sessionId: string): AnswerRecord[] {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);
    return this.store.getLatestAnswersBySession(sessionId);
  }

  generateBlueprint(sessionId: string): object {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);
    if (session.status !== "ready_for_generation" && session.status !== "completed") {
      throw new Error(
        `Session must be ready_for_generation before generating a blueprint (current: ${session.status})`,
      );
    }

    const project = this.store.getProject(session.projectId);
    if (!project) throw new NotFoundError("Project", session.projectId);

    instrumentGenerationFunnel(session.projectId, "attempted");
    logAudit("generation.attempted", session.projectId, sessionId, {
      taskType: "blueprint",
      provider: "",
      model: "",
    });

    const answers = this.store.getLatestAnswersBySession(sessionId);
    const existingPlans = this.store.getPlansByProject(project.id);

    this.log("blueprint.generation_started", {
      sessionId,
      projectId: project.id,
      existingPlanCount: existingPlans.length,
    });

    const planVersion = existingPlans.length + 1;

    const plan: PlanRecord = {
      id: crypto.randomUUID(),
      projectId: project.id,
      version: planVersion,
      status: "complete",
      staleAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.insertPlan(plan);

    try {
      const generator = new BlueprintGenerator();
      const output = generator.generate(project, session, answers, plan.id, planVersion);
      const flagCount = output.ambiguityFlags.length;

      if (flagCount > 0) {
        const byType: Record<string, number> = {};
        for (const f of output.ambiguityFlags) {
          byType[f.type] = (byType[f.type] ?? 0) + 1;
        }
        this.log("ambiguity.detected", { sessionId, total: flagCount, byType });
      }

      this.log("blueprint.generated", {
        sessionId,
        planId: plan.id,
        planVersion,
        phases: output.phases.length,
        confidence: output.overallConfidence,
        flags: flagCount,
      });

      this.store.insertBlueprint({
        id: crypto.randomUUID(),
        planId: plan.id,
        projectId: project.id,
        content: JSON.stringify(output),
        format: "json",
        version: planVersion,
        status: "complete",
        staleAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.transitionSession(sessionId, "completed");
      this.log("blueprint.completed", { sessionId, planVersion });
      instrumentGenerationFunnel(session.projectId, "completed", {
        phaseCount: output.phases.length,
        confidence: output.overallConfidence,
      });
      logAudit("generation.completed", session.projectId, sessionId, {
        planVersion,
        phases: output.phases.length,
        confidence: output.overallConfidence,
      });

      return output;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      instrumentGenerationFunnel(session.projectId, "failed", { errorCategory: "terminal" });
      this.log("blueprint.generation_failed", { sessionId, planVersion, error: errorMsg });
      logAudit("generation.failed", session.projectId, sessionId, {
        planVersion,
        error: errorMsg,
        errorCategory: "terminal",
      });
      // Track failure spike
      const spike = this.spikeDetector.record("unknown", "terminal");
      if (spike) {
        this.log("provider.spike_detected", { provider: spike.provider, failures: spike.failures });
      }
      // Session stays in ready_for_generation for retry;
      // orphan plan row is acceptable — next retry creates a new version.
      throw err;
    }
  }

  transitionSession(sessionId: string, toStatus: string): SessionRecord {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError("InterviewSession", sessionId);

    if (session.status === toStatus) return session;

    const state = this.toState(session);
    const updated = transitionState(state, toStatus as any);
    this.store.updateSession(sessionId, {
      status: updated.status,
      startedAt: updated.startedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
    });

    return {
      ...session,
      ...updated,
      startedAt: updated.startedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  private toState(session: SessionRecord): InterviewState {
    return {
      sessionId: session.id,
      projectId: session.projectId,
      status: session.status,
      currentPhaseIndex: session.currentPhaseIndex,
      currentQuestionIndex: session.currentQuestionIndex,
      answeredQuestionIds: [],
      mode: (session as any).mode ?? "quick",
      refinementComplete: false,
      startedAt: session.startedAt ? new Date(session.startedAt) : null,
      completedAt: session.completedAt ? new Date(session.completedAt) : null,
    };
  }
}
