"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuestionRenderer } from "./question-renderer";
import { ProgressBar } from "./progress-bar";
import {
  getNextQuestion,
  submitAnswer,
  startInterview,
  transitionSession,
  generateBlueprint,
  resumeSession,
} from "@/lib/api";
import type { QuestionPayload } from "@/lib/api";

interface InterviewViewProps {
  sessionId: string;
}

interface HistoryEntry {
  question: QuestionPayload;
  value: string;
}

export function InterviewView({ sessionId }: InterviewViewProps) {
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [initialValue, setInitialValue] = useState("");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getNextQuestion(sessionId);
      setQuestion(result.question);
      setInitialValue("");
      setPhaseIndex(result.phaseIndex);
      setTotal(result.total);
      setAnswered(result.answered);
      if (!result.question) {
        setFinished(true);
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
      await loadNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save answer");
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-gray-100" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadNext}
          className="mt-4 rounded-lg bg-orchestra-600 px-4 py-2 text-sm text-white hover:bg-orchestra-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <ProgressBar currentPhaseIndex={phaseIndex} total={total} answered={answered} />

      {history.length > 0 && (
        <p className="text-xs text-text-secondary">
          {answered} question{answered !== 1 ? "s" : ""} answered, {history.length} in this session
        </p>
      )}

      {finished ? (
        <div className="rounded-xl border-2 border-dashed border-orchestra-200 bg-orchestra-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-text-primary">All questions answered</h2>
          <p className="mt-2 text-sm text-text-secondary">
            You&apos;ve answered all available questions. Generate your project plan now.
          </p>

          <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-lg border border-border bg-white p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Estimated generation cost
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Architecture reasoning (strong)</span>
              <span className="font-medium text-text-primary">~$0.02</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Roadmap (balanced)</span>
              <span className="font-medium text-text-primary">~$0.005</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm">
              <span className="font-medium text-text-primary">Estimated total</span>
              <span className="font-semibold text-text-primary">~$0.025</span>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-3">
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
              className="rounded-lg bg-orchestra-600 px-6 py-2 text-sm font-medium text-white hover:bg-orchestra-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate project plan"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
          />
          {submitting && <p className="mt-3 text-sm text-text-secondary">Saving...</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      ) : null}
    </div>
  );
}
