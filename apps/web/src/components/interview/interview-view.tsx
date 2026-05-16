"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuestionRenderer } from "./question-renderer";
import { ProgressBar } from "./progress-bar";
import { PhaseNotice } from "./phase-notice";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { LiveAnnouncer } from "@/components/ui/live-announcer";
import {
  getNextQuestion,
  submitAnswer,
  startInterview,
  transitionSession,
  generateBlueprint,
  resumeSession,
} from "@/lib/api";
import type { QuestionPayload, NextQuestionResult } from "@/lib/api";

interface InterviewViewProps {
  sessionId: string;
}

interface HistoryEntry {
  question: QuestionPayload;
  value: string;
}

const INTERVIEW_PHASES = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
];

const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation",
  requirements: "Requirements",
  architecture: "Architecture",
  security: "Security",
  database: "Database",
  backend: "Backend",
  frontend: "Frontend",
  "core-features": "Core Features",
  "ai-systems": "AI Systems",
  testing: "Testing",
  deployment: "Deployment",
  monitoring: "Monitoring",
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dismissedPhaseNotices, setDismissedPhaseNotices] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const finishedHeadingRef = useRef<HTMLHeadingElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result: NextQuestionResult = await getNextQuestion(sessionId);
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
  }, [sessionId]);

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
    setAnnouncement(`Returned to previous question: ${prev.question.text}`);
  };

  const [quickFilling, setQuickFilling] = useState(false);

  const quickFillDefault = (q: QuestionPayload): string => {
    if (q.options?.includes("Not sure yet")) return "Not sure yet";
    switch (q.type) {
      case "select":
      case "multi_select":
        return q.options?.[0] ?? "";
      case "boolean":
        return "true";
      case "scale":
        return "3";
      default:
        return "I am not sure yet — do what you think is more optimal";
    }
  };

  const handleQuickFill = async () => {
    setQuickFilling(true);
    setError("");
    try {
      let next = await getNextQuestion(sessionId);
      while (next.question) {
        const val = quickFillDefault(next.question);
        await submitAnswer(sessionId, next.question.id, val);
        next = await getNextQuestion(sessionId);
      }
      await transitionSession(sessionId, "ready_for_generation");
      await generateBlueprint(sessionId);
      router.push(`/projects/${sessionId}/summary`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to quick-fill");
      setQuickFilling(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      await transitionSession(sessionId, "ready_for_generation");
      await generateBlueprint(sessionId);
      router.push(`/projects/${sessionId}/summary`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate plan");
      setGenerating(false);
    }
  };

  const showInsufficientNotice = (): boolean => {
    if (phaseIndex <= 0 || dismissedPhaseNotices.has(INTERVIEW_PHASES[phaseIndex - 1])) return false;
    const prevPhase = INTERVIEW_PHASES[phaseIndex - 1];
    const prevAnswers = history.filter((h) => h.question.phaseType === prevPhase);
    if (prevAnswers.length === 0) return true;
    const shortAnswers = prevAnswers.filter((h) => h.value.trim().length < 15);
    return shortAnswers.length >= prevAnswers.length / 2;
  };

  const prevPhaseLabel = phaseIndex > 0 ? PHASE_LABELS[INTERVIEW_PHASES[phaseIndex - 1]] : "";

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6" role="status" aria-label="Loading interview">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-2 w-full animate-pulse rounded-full bg-gray-200" />
        <div className="h-6 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-gray-100" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadNext}
            className="mt-4 rounded-lg bg-orchestra-600 px-4 py-2 text-sm text-white hover:bg-orchestra-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentPhaseType = question?.phaseType ?? INTERVIEW_PHASES[phaseIndex] ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <LiveAnnouncer message={announcement} />

      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Interview" }]} />

      <StepIndicator current="interview" compact />

      <ProgressBar currentPhaseIndex={phaseIndex} total={total} answered={answered} />

      <div className="flex justify-end">
        <button
          onClick={handleQuickFill}
          disabled={quickFilling}
          aria-busy={quickFilling}
          className="rounded-lg border border-dashed border-orchestra-300 bg-orchestra-50 px-4 py-2 text-sm font-medium text-orchestra-700 hover:bg-orchestra-100 disabled:opacity-50"
        >
          {quickFilling ? "Filling & generating..." : "Quick fill & generate (skip all questions)"}
        </button>
      </div>

      {currentPhaseType && (
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="rounded-full bg-orchestra-100 px-2.5 py-0.5 text-xs font-medium text-orchestra-700">
            Phase {INTERVIEW_PHASES.indexOf(currentPhaseType) + 1} of {INTERVIEW_PHASES.length}
          </span>
          <span className="text-sm font-medium text-text-primary">
            {PHASE_LABELS[currentPhaseType] ?? currentPhaseType}
          </span>
          {question && (
            <span className="ml-auto text-xs text-text-secondary" aria-hidden="true">
              Question {questionIndex + 1}
            </span>
          )}
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
            setDismissedPhaseNotices((prev) => new Set(prev).add(INTERVIEW_PHASES[phaseIndex - 1]))
          }
        />
      )}

      {history.length > 0 && !finished && (
        <button
          ref={backButtonRef}
          onClick={handleBack}
          className="text-sm text-orchestra-600 hover:text-orchestra-700"
        >
          &larr; Back to previous question
        </button>
      )}

      {finished ? (
        <div
          className="rounded-xl border-2 border-orchestra-200 bg-orchestra-50 p-8 text-center"
          role="region"
          aria-label="Interview complete"
        >
          <h2 ref={finishedHeadingRef} className="text-xl font-semibold text-text-primary" tabIndex={-1}>
            All questions answered
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            You&apos;ve answered all available questions. Review a summary below, then generate your project
            plan.
          </p>

          <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Phase summary</p>
            <ul className="space-y-3">
              {INTERVIEW_PHASES.map((phase) => {
                const phaseQ = history.filter((h) => h.question.phaseType === phase);
                const isEmpty = phaseQ.length === 0;
                return (
                  <li
                    key={phase}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      isEmpty
                        ? "border-gray-200 bg-gray-50 text-gray-400"
                        : "border-green-200 bg-green-50 text-green-800"
                    }`}
                  >
                    <span>{PHASE_LABELS[phase] ?? phase}</span>
                    <span className="text-xs">
                      {isEmpty ? "No answers" : `${phaseQ.length} answer${phaseQ.length !== 1 ? "s" : ""}`}
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
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-text-secondary hover:bg-gray-50"
              >
                Review answers
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              aria-busy={generating}
              className="rounded-lg bg-orchestra-600 px-6 py-2 text-sm font-medium text-white hover:bg-orchestra-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate project plan"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : question ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          {history.length > 0 && (
            <button
              onClick={handleBack}
              className="mb-4 text-sm font-medium text-orchestra-600 hover:text-orchestra-700"
            >
              &larr; Back to previous question
            </button>
          )}
          <QuestionRenderer
            question={question}
            initialValue={initialValue}
            onSubmit={handleAnswer}
            onSkip={handleSkip}
            headingRef={questionHeadingRef}
          />
          {submitting && (
            <p className="mt-3 text-sm text-text-secondary" role="status" aria-label="Saving answer">
              Saving...
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
