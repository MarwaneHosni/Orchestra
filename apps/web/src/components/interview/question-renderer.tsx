"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { QuestionPayload } from "@/lib/api";

interface QuestionRendererProps {
  question: QuestionPayload;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onSkip: () => void;
  showTips?: boolean;
}

const AGENT_TIPS = [
  "Consider edge cases: empty states, error states, boundary conditions",
  "Think about security: input validation, authentication, data protection",
  "Check dependencies: how does this connect to other parts of the system?",
];

export function QuestionRenderer({
  question,
  initialValue,
  onSubmit,
  onSkip,
  showTips: defaultShowTips = false,
}: QuestionRendererProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState("");
  const [tipsOpen, setTipsOpen] = useState(defaultShowTips);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{question.text}</h2>
        {question.helpText && <p className="mt-1 text-sm text-text-secondary">{question.helpText}</p>}
        {question.validation?.maxLength && (
          <p className="mt-1 text-xs text-text-secondary">
            Max {question.validation.maxLength} characters
            {value.length > 0 && ` · ${value.length}/${question.validation.maxLength}`}
          </p>
        )}
      </div>

      <QuestionInput question={question} value={value} onChange={setValue} error={error} />

      {error && <p className="text-sm text-red-600">{error}</p>}

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
      </div>

      <div>
        <button
          type="button"
          onClick={() => setTipsOpen(!tipsOpen)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <span>{tipsOpen ? "▼" : "▶"} Tips for answering</span>
        </button>
        {tipsOpen && (
          <ul className="mt-2 space-y-1 rounded-lg border border-border bg-surface-secondary p-3">
            {AGENT_TIPS.map((tip, i) => (
              <li key={i} className="text-xs text-text-secondary">
                {tip}
              </li>
            ))}
          </ul>
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
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={question.validation?.maxLength ?? undefined}
          placeholder="Type your answer..."
          className={baseInput}
          aria-invalid={!!error}
        />
      );

    case "select":
      return (
        <div className="space-y-2">
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
                name="select"
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
        <div className="space-y-2">
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
        <div className="flex gap-4">
          {["true", "false"].map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={cn(
                "flex-1 rounded-lg border px-6 py-3 text-sm font-medium transition-colors",
                value === opt
                  ? "border-orchestra-500 bg-orchestra-50 text-orchestra-700"
                  : "border-border text-text-secondary hover:bg-gray-50",
              )}
            >
              {opt === "true" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );

    case "scale":
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(String(n))}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                value === String(n)
                  ? "border-orchestra-500 bg-orchestra-50 text-orchestra-700"
                  : "border-border text-text-secondary hover:bg-gray-50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      );
  }
}
