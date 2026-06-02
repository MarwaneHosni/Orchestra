"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuestionRenderer } from "./question-renderer";
import { ProgressBar } from "./progress-bar";
import { PhaseNotice } from "./phase-notice";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LiveAnnouncer } from "@/components/ui/live-announcer";
import { ThinkingLoader } from "@/components/ui/skeleton";
import {
  getNextQuestion,
  submitAnswer,
  startInterview,
  transitionSession,
  generateBlueprint,
  resumeSession,
} from "@/lib/api";
import type { QuestionPayload, NextQuestionResult } from "@/lib/api";
import { useProgress } from "@/lib/use-progress";
import { GenerationProgress } from "./generation-progress";

interface InterviewViewProps {
  sessionId: string;
}

interface HistoryEntry {
  question: QuestionPayload;
  value: string;
}

const PHASES = [
  "ideation", "requirements", "architecture", "security",
  "database", "backend", "frontend", "core-features",
  "ai-systems", "testing", "deployment", "monitoring",
];

const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation & Discovery",
  requirements: "Requirements Engineering",
  architecture: "System Architecture",
  security: "Security Planning",
  database: "Database Design",
  backend: "Backend Design",
  frontend: "Frontend Design",
  "core-features": "Core Features",
  "ai-systems": "AI Systems",
  testing: "Testing",
  deployment: "Deployment",
  monitoring: "Monitoring",
};

const PHASE_INTROS: Record<string, string> = {
  ideation: "First, let&apos;s understand your project idea — what you&apos;re building, who it&apos;s for, and what success looks like.",
  requirements: "Now let&apos;s define the core functionality and user needs that will drive the project plan.",
  architecture: "Let&apos;s establish the technical foundation — your preferences on tech stack, data flow, and system characteristics.",
  security: "A few quick questions about compliance and data handling to make sure the plan addresses security requirements.",
  database: "Let&apos;s think about what data your application will manage and how it should be stored.",
  backend: "Now let&apos;s define the backend services your application needs to function.",
  frontend: "Let&apos;s determine the frontend capabilities and rendering approach that fits your project.",
  "core-features": "A couple of focused questions about your most complex feature and architectural boundaries.",
  "ai-systems": "Let&apos;s check if your project needs AI or machine learning capabilities.",
  testing: "A quick look at your testing expectations and quality assurance approach.",
  deployment: "Let&apos;s consider where and how your application will be deployed.",
  monitoring: "Finally, let&apos;s think about how you&apos;ll keep the system running smoothly in production.",
};

const PHASE_GROUP: Record<string, string> = {
  ideation: "Foundation", requirements: "Foundation", architecture: "Foundation", security: "Foundation",
  database: "Core", backend: "Core", frontend: "Core", "core-features": "Core", "ai-systems": "Core",
  testing: "Infrastructure", deployment: "Infrastructure",
  monitoring: "Operations",
};

export function InterviewView({ sessionId }: InterviewViewProps) {
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [initialValue, setInitialValue] = useState("");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const progress = useProgress(workflowId);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dismissedPhaseNotices, setDismissedPhaseNotices] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [showPhaseIntro, setShowPhaseIntro] = useState(true);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const finishedHeadingRef = useRef<HTMLHeadingElement>(null);

  const currentPhaseType = question?.phaseType ?? PHASES[phaseIndex] ?? "";
  const phaseIntro = PHASE_INTROS[currentPhaseType] ?? "";

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result: NextQuestionResult = await getNextQuestion(sessionId);
      const newPhaseType = result.question?.phaseType ?? PHASES[result.phaseIndex] ?? "";

      if (result.question && newPhaseType !== currentPhaseType && history.length > 0) {
        setShowPhaseIntro(true);
      }

      setQuestion(result.question);
      setInitialValue("");
      setPhaseIndex(result.phaseIndex);
      setQuestionIndex(result.questionIndex ?? 0);
      setTotal(result.total);
      setAnswered(result.answered);
      if (!result.question) {
        setFinished(true);
        setAnnouncement("All questions answered. Review your answers or generate the plan.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load question");
    } finally {
      setLoading(false);
    }
  }, [sessionId, currentPhaseType, history.length]);

  useEffect(() => {
    const init = async () => {
      try {
        const resume = await resumeSession(sessionId);
        if (resume.session.status === "completed" || resume.session.status === "ready_for_generation") {
          const result = await getNextQuestion(sessionId);
          setQuestion(result.question);
          setPhaseIndex(result.phaseIndex);
          setQuestionIndex(result.questionIndex ?? 0);
          setTotal(result.total);
          setAnswered(result.answered);
          if (!result.question) setFinished(true);
          setLoading(false);
          return;
        }

        await startInterview(sessionId);
        await loadNext();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start interview");
        setLoading(false);
      }
    };
    init();
  }, [sessionId, loadNext]);

  useEffect(() => {
    if (!loading && question && questionHeadingRef.current) {
      questionHeadingRef.current.focus();
    }
  }, [question, loading]);

  useEffect(() => {
    if (finished && finishedHeadingRef.current) {
      finishedHeadingRef.current.focus();
    }
  }, [finished]);

  const handleAnswer = async (value: string) => {
    if (!question) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitAnswer(sessionId, question.id, value);
      setHistory((prev) => [...prev, { question, value }]);
      if (result.edited) {
        setHistory((prev) => prev.slice(0, -1));
        setHistory((prev) => [...prev, { question, value }]);
      }
      setShowPhaseIntro(false);
      setAnnouncement("Answer saved");
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save answer");
      setAnnouncement("Failed to save answer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!question) return;
    setSubmitting(true);
    try {
      await submitAnswer(sessionId, question.id, "");
      setHistory((prev) => [...prev, { question, value: "" }]);
      setShowPhaseIntro(false);
      setAnnouncement("Question skipped");
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to skip");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setQuestion(prev.question);
    setInitialValue(prev.value);
    setFinished(false);
    setPhaseIndex(Math.max(0, phaseIndex - 1));
    setShowPhaseIntro(false);
    setAnnouncement(`Returned to previous question: ${prev.question.text}`);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    const wfId = crypto.randomUUID();
    setWorkflowId(wfId);
    console.log("[DEBUG] handleGenerate: starting generation", { sessionId, wfId });
    try {
      console.log("[DEBUG] handleGenerate: transitioning session to ready_for_generation", { sessionId });
      await transitionSession(sessionId, "ready_for_generation");
      console.log("[DEBUG] handleGenerate: session transitioned, calling generateBlueprint", { sessionId, wfId });
      const start = Date.now();
      await generateBlueprint(sessionId, wfId);
      const elapsed = Date.now() - start;
      console.log("[DEBUG] handleGenerate: generateBlueprint completed", { sessionId, wfId, elapsedMs: elapsed });
      router.push(`/projects/${sessionId}/summary?generated=1`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate plan";
      console.error("[DEBUG] handleGenerate: generation failed", { sessionId, wfId, error: msg });
      setError(msg);
      setGenerating(false);
      setWorkflowId(null);
    }
  };

  const showInsufficientNotice = (): boolean => {
    if (phaseIndex <= 0 || dismissedPhaseNotices.has(PHASES[phaseIndex - 1])) return false;
    const prevPhase = PHASES[phaseIndex - 1];
    const prevAnswers = history.filter((h) => h.question.phaseType === prevPhase);
    if (prevAnswers.length === 0) return true;
    const shortAnswers = prevAnswers.filter((h) => h.value.trim().length < 15);
    return shortAnswers.length >= prevAnswers.length / 2;
  };

  const prevPhaseLabel = phaseIndex > 0 ? PHASE_LABELS[PHASES[phaseIndex - 1]] : "";

  const answeredCount = () => {
    const ids = new Set(history.map((h) => h.question.id));
    return ids.size;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" role="status" aria-label="Loading interview">
        <ThinkingLoader />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="py-16">
        <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-6 text-center" role="alert">
          <p className="text-accent-red">{error}</p>
          <button
            onClick={loadNext}
            className="mt-4 rounded bg-accent-purple px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LiveAnnouncer message={announcement} />

      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Interview" }]} />

      <StepIndicator current="interview" compact />

      <ProgressBar currentPhaseIndex={phaseIndex} total={total} answered={answeredCount()} />

      {showPhaseIntro && !finished && phaseIntro && (
        <div className="rounded border border-accent-purple-dim bg-accent-purple-dim/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-accent-purple-dim px-2.5 py-0.5 text-xs font-medium text-accent-purple">
              {PHASE_GROUP[currentPhaseType] ?? ""}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {PHASE_LABELS[currentPhaseType] ?? currentPhaseType}
            </span>
          </div>
          <p className="text-sm text-text-secondary" dangerouslySetInnerHTML={{ __html: phaseIntro }} />
          <button
            onClick={() => setShowPhaseIntro(false)}
            className="mt-2 text-xs font-medium text-accent-purple hover:underline underline-offset-2"
          >
            Got it →
          </button>
        </div>
      )}

      {showInsufficientNotice() && (
        <PhaseNotice
          type="insufficient"
          phaseName={prevPhaseLabel}
          details={[
            "Your answers were on the shorter side — consider adding more detail.",
            "More specific answers lead to a better project plan.",
          ]}
          onProvideMore={handleBack}
          onContinue={() =>
            setDismissedPhaseNotices((prev) => new Set(prev).add(PHASES[phaseIndex - 1]))
          }
        />
      )}

      {finished ? (
        <div
          className="rounded border-2 border-accent-purple-dim bg-accent-purple-dim/30 p-8 text-center"
          role="region"
          aria-label="Interview complete"
        >
          <h2 ref={finishedHeadingRef} className="text-base font-semibold text-text-primary" tabIndex={-1}>
            You&apos;re all set
          </h2>
          <p className="mt-2 text-xs text-text-secondary">
            You&apos;ve answered enough questions to generate a detailed project plan.
            {answered < total ? " Some advanced questions were skipped — you can refine these after reviewing the plan." : ""}
          </p>

          <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Phase summary</p>
            <ul className="space-y-2">
              {PHASES.map((phase) => {
                const phaseQ = history.filter((h) => h.question.phaseType === phase);
                const isEmpty = phaseQ.length === 0;
                return (
                  <li
                    key={phase}
                    className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                      isEmpty
                        ? "border-border-subtle bg-bg-surface text-text-muted"
                        : "border-accent-green-dim bg-accent-green-dim/30 text-accent-green"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${isEmpty ? "bg-border-default" : "bg-accent-green"}`} />
                      {PHASE_LABELS[phase] ?? phase}
                    </span>
                    <span className="text-xs">
                      {isEmpty ? "Skipped" : `${phaseQ.length} answer${phaseQ.length !== 1 ? "s" : ""}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            {history.length > 0 && (
              <button
                onClick={handleBack}
                className="rounded border border-border-default bg-bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                Review answers
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              aria-busy={generating}
              className="rounded bg-accent-purple px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate project plan"}
            </button>
          </div>
          {generating && (
            <GenerationProgress
              workflowId={workflowId}
              onCancel={() => {
                setGenerating(false);
                setWorkflowId(null);
              }}
            />
          )}
          {error && (
            <p className="mt-2 text-xs text-accent-red" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : question ? (
        <div className="rounded border border-border-default bg-bg-elevated p-6">
          <QuestionRenderer
            question={question}
            initialValue={initialValue}
            onSubmit={handleAnswer}
            onSkip={handleSkip}
            headingRef={questionHeadingRef}
          />
          {submitting && (
            <p className="mt-3 text-xs text-text-muted" role="status" aria-label="Saving answer">
              Saving...
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs text-accent-red" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
