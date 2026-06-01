"use client";

import { useState, useId, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { QuestionPayload } from "@/lib/api";

interface QuestionRendererProps {
  question: QuestionPayload;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onSkip: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

const WHY_MATTERS: Record<string, string> = {
  ideation: "Helps define the project scope and target audience for the entire plan.",
  requirements: "Core feature decisions drive the architecture and implementation priorities.",
  architecture: "Tech stack and data flow choices shape the entire system design.",
  security: "Compliance and data handling requirements affect architecture and deployment.",
  database: "Data shape and volume determine storage strategy and query patterns.",
  backend: "Backend capabilities define the API surface and service architecture.",
  frontend: "Frontend requirements guide the UI framework and rendering strategy.",
  "core-features": "The most complex feature determines the critical path in the execution plan.",
  "ai-systems": "AI integration affects infrastructure, dependencies, and scaling considerations.",
  testing: "Testing strategy ensures quality and influences development workflow.",
  deployment: "Hosting and CI/CD choices affect release process and operational overhead.",
  monitoring: "Observability requirements ensure the system remains reliable in production.",
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "Required", color: "bg-orchestra-100 text-orchestra-700" },
  "high-value": { label: "Important", color: "bg-blue-100 text-blue-700" },
  optional: { label: "Optional", color: "bg-gray-100 text-gray-600" },
  contextual: { label: "Context dependent", color: "bg-amber-100 text-amber-700" },
};

const NOT_SURE_TEXT = "I am not sure yet — do what you think is more optimal";

export function QuestionRenderer({
  question,
  initialValue,
  onSubmit,
  onSkip,
  headingRef,
}: QuestionRendererProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState("");
  const errorId = useId();

  const category = question.category ?? "high-value";
  const catInfo = CATEGORY_LABELS[category] ?? CATEGORY_LABELS["high-value"];
  const whyMatters = WHY_MATTERS[question.phaseType] ?? "";

  const handleSubmit = () => {
    if (question.required && !value.trim()) {
      setError("This question requires an answer");
      return;
    }
    if (question.validation?.minLength && value.trim().length < question.validation.minLength) {
      setError(`Answer must be at least ${question.validation.minLength} characters`);
      return;
    }
    setError("");
    onSubmit(value.trim());
  };

  const handleSelectDefault = () => {
    if (question.options?.includes("Not sure yet")) {
      setValue("Not sure yet");
    } else if (question.type === "boolean") {
      setValue("false");
    } else if (question.type === "select" || question.type === "multi_select") {
      setValue(question.options?.[0] ?? "");
    } else if (question.type === "scale") {
      setValue("3");
    } else {
      setValue(NOT_SURE_TEXT);
    }
  };

  const hasOptions =
    question.type === "select" ||
    question.type === "multi_select" ||
    question.type === "boolean" ||
    question.type === "scale";

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          {!question.required && (
            <span className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500">
              Optional
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catInfo.color}`}>
            {catInfo.label}
          </span>
        </div>

        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-text-primary">
          {question.text}
        </h2>

        {question.helpText && <p className="mt-1 text-sm text-text-secondary">{question.helpText}</p>}

        {whyMatters && (
          <p className="mt-2 text-xs text-gray-500 italic">
            Why this matters: {whyMatters}
          </p>
        )}

        {question.validation?.maxLength && (
          <p className="mt-1 text-xs text-text-secondary">
            Max {question.validation.maxLength} characters
            {value.length > 0 && ` · ${value.length}/${question.validation.maxLength}`}
          </p>
        )}
      </div>

      {hasOptions ? (
        <fieldset aria-describedby={error ? errorId : undefined}>
          <legend className="sr-only">{question.text}</legend>
          <QuestionInput question={question} value={value} onChange={setValue} error={error} />
        </fieldset>
      ) : (
        <QuestionInput question={question} value={value} onChange={setValue} error={error} />
      )}

      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-orchestra-600 px-6 py-2 text-sm font-medium text-white hover:bg-orchestra-700 focus:outline-none focus:ring-2 focus:ring-orchestra-500 focus:ring-offset-2"
        >
          {question.required ? "Submit answer" : "Save"}
        </button>
        {!question.required && (
          <button
            onClick={onSkip}
            className="rounded-lg border border-border bg-white px-6 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50"
          >
            Skip
          </button>
        )}
        {question.type === "text" && (
          <button
            type="button"
            onClick={handleSelectDefault}
            className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            I&apos;m not sure
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  error,
}: {
  question: QuestionPayload;
  value: string;
  onChange: (v: string) => void;
  error: string;
}) {
  const baseInput = cn(
    "block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary",
    "focus:outline-none focus:ring-2 focus:ring-orchestra-500 focus:border-orchestra-500",
    error ? "border-red-500" : "border-border",
  );

  switch (question.type) {
    case "text":
      return (
        <div className="space-y-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            maxLength={question.validation?.maxLength ?? undefined}
            placeholder="Type your answer..."
            className={baseInput}
            aria-invalid={!!error}
            aria-required={question.required}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2" role="radiogroup" aria-label={question.text}>
          {question.options.map((opt) => (
            <label
              key={opt}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                value === opt
                  ? "border-orchestra-500 bg-orchestra-50 text-orchestra-700"
                  : "border-border hover:bg-gray-50",
              )}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4 accent-orchestra-600"
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case "multi_select": {
      const selected = value ? value.split(",").filter(Boolean) : [];
      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
        onChange(next.join(","));
      };
      return (
        <div className="space-y-2" role="group" aria-label={question.text}>
          {question.options.map((opt) => (
            <label
              key={opt}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                selected.includes(opt)
                  ? "border-orchestra-500 bg-orchestra-50 text-orchestra-700"
                  : "border-border hover:bg-gray-50",
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-4 w-4 accent-orchestra-600 rounded"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }

    case "boolean":
      return (
        <div className="flex gap-4" role="radiogroup" aria-label={question.text}>
          {["true", "false"].map((opt) => {
            const isSelected = value === opt;
            return (
              <div key={opt} className="flex-1">
                <input
                  type="radio"
                  id={`${question.id}-${opt}`}
                  name={`question-${question.id}-boolean`}
                  value={opt}
                  checked={isSelected}
                  onChange={() => onChange(opt)}
                  className="sr-only peer"
                />
                <label
                  htmlFor={`${question.id}-${opt}`}
                  className={cn(
                    "block cursor-pointer rounded-lg border px-6 py-3 text-center text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-orchestra-500",
                    isSelected
                      ? "border-orchestra-500 bg-orchestra-50 text-orchestra-700"
                      : "border-border text-text-secondary hover:bg-gray-50",
                  )}
                >
                  {opt === "true" ? "Yes" : "No"}
                </label>
              </div>
            );
          })}
        </div>
      );

    case "scale":
      return (
        <div className="flex gap-2" role="radiogroup" aria-label={question.text}>
          {[1, 2, 3, 4, 5].map((n) => {
            const strN = String(n);
            const isSelected = value === strN;
            return (
              <div key={n}>
                <input
                  type="radio"
                  id={`${question.id}-scale-${n}`}
                  name={`question-${question.id}-scale`}
                  value={strN}
                  checked={isSelected}
                  onChange={() => onChange(strN)}
                  className="sr-only peer"
                />
                <label
                  htmlFor={`${question.id}-scale-${n}`}
                  className={cn(
                    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-orchestra-500",
                    isSelected
                      ? "border-orchestra-500 bg-orchestra-50 text-orchestra-700"
                      : "border-border text-text-secondary hover:bg-gray-50",
                  )}
                >
                  {n}
                </label>
              </div>
            );
          })}
        </div>
      );
  }
}
