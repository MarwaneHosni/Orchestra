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
  critical: { label: "required", color: "var(--color-accent-purple)" },
  "high-value": { label: "important", color: "var(--color-text-secondary)" },
  optional: { label: "optional", color: "var(--color-text-muted)" },
  contextual: { label: "context dependent", color: "var(--color-accent-amber)" },
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
    <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className="space-y-5">
      <div>
        <div className="flex items-center gap-3 mb-3" style={{ fontSize: 12 }}>
          <span style={{ color: "var(--color-text-muted)" }}>
            [{question.phaseType}]
          </span>
          {!question.required && (
            <span style={{ color: "var(--color-text-muted)" }}>[optional]</span>
          )}
          <span style={{ color: catInfo.color }}>[{catInfo.label}]</span>
        </div>

        <p
          ref={headingRef as React.Ref<HTMLParagraphElement>}
          tabIndex={-1}
          style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-text-primary)" }}
        >
          <span style={{ color: "var(--color-accent-purple)", fontWeight: 700, marginRight: 8 }}>&gt;</span>
          {question.text}
        </p>

        {question.helpText && (
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>{question.helpText}</p>
        )}

        {whyMatters && (
          <p style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            Why this matters: {whyMatters}
          </p>
        )}

        {question.validation?.maxLength && (
          <p style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
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
        <p id={errorId} style={{ fontSize: 12, color: "var(--color-accent-red)" }} role="alert">
          ✗ {error}
        </p>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleSubmit}
          style={{ borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }}
          className="bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
        >
          {question.required ? "Submit answer" : "Save"}
        </button>
        {!question.required && (
          <button
            onClick={onSkip}
            style={{ borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }}
            className="border border-border-default bg-transparent text-text-primary font-medium hover:border-border-strong hover:bg-bg-hover transition-[color,background-color,border-color,opacity,transform] duration-150"
          >
            Skip
          </button>
        )}
        {question.type === "text" && (
          <button
            type="button"
            onClick={handleSelectDefault}
            style={{ borderRadius: 3, padding: "8px 16px", fontSize: 13, fontFamily: "inherit" }}
            className="border border-dashed border-border-default bg-transparent text-text-muted font-medium hover:bg-bg-hover transition-colors duration-150"
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
  const baseStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    borderRadius: 3,
    border: `1px solid ${error ? "var(--color-accent-red)" : "var(--color-border-default)"}`,
    background: "var(--color-bg-elevated)",
    padding: "8px 12px",
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--color-text-primary)",
  };

  const focusClasses = "focus:outline-none focus:shadow-[0_0_0_2px_var(--color-accent-purple-dim)] focus:border-accent-purple";

  switch (question.type) {
    case "text":
      return (
        <div style={{ position: "relative" }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            maxLength={question.validation?.maxLength ?? undefined}
            placeholder="> type your answer..."
            className={`block w-full ${error ? "border-accent-red" : ""} placeholder:text-text-muted ${focusClasses}`}
            style={baseStyle}
            aria-invalid={!!error}
            aria-required={question.required}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-3" role="radiogroup" aria-label={question.text}>
          {question.options.map((opt) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 3,
                border: `1px solid ${value === opt ? "var(--color-accent-purple)" : "var(--color-border-default)"}`,
                background: value === opt ? "var(--color-accent-purple-dim)" : "transparent",
                padding: "10px 14px",
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
                color: value === opt ? "var(--color-accent-purple)" : "var(--color-text-primary)",
              }}
              className="transition-colors duration-150 hover:bg-bg-hover"
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: `2px solid ${value === opt ? "var(--color-accent-purple)" : "var(--color-border-default)"}`,
                  background: value === opt ? "var(--color-accent-purple)" : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {value === opt && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                )}
              </span>
              <input
                type="radio"
                name={`question-${question.id}`}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only"
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
        <div className="space-y-3" role="group" aria-label={question.text}>
          {question.options.map((opt) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 3,
                border: `1px solid ${selected.includes(opt) ? "var(--color-accent-purple)" : "var(--color-border-default)"}`,
                background: selected.includes(opt) ? "var(--color-accent-purple-dim)" : "transparent",
                padding: "10px 14px",
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
                color: selected.includes(opt) ? "var(--color-accent-purple)" : "var(--color-text-primary)",
              }}
              className="transition-colors duration-150 hover:bg-bg-hover"
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: `1px solid ${selected.includes(opt) ? "var(--color-accent-purple)" : "var(--color-border-default)"}`,
                  background: selected.includes(opt) ? "var(--color-accent-purple)" : "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {selected.includes(opt) && (
                  <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>
                )}
              </span>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="sr-only"
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
              <div key={opt} style={{ flex: 1 }}>
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
                  style={{
                    display: "block",
                    borderRadius: 3,
                    border: `1px solid ${isSelected ? "var(--color-accent-purple)" : "var(--color-border-default)"}`,
                    background: isSelected ? "var(--color-accent-purple-dim)" : "transparent",
                    padding: "10px 0",
                    textAlign: "center",
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                    cursor: "pointer",
                    color: isSelected ? "var(--color-accent-purple)" : "var(--color-text-secondary)",
                  }}
                  className="transition-colors duration-150 hover:bg-bg-hover"
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
        <div className="flex gap-3" role="radiogroup" aria-label={question.text}>
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 3,
                    border: `1px solid ${isSelected ? "var(--color-accent-purple)" : "var(--color-border-default)"}`,
                    background: isSelected ? "var(--color-accent-purple-dim)" : "transparent",
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 500,
                    cursor: "pointer",
                    color: isSelected ? "var(--color-accent-purple)" : "var(--color-text-secondary)",
                  }}
                  className="transition-colors duration-150 hover:bg-bg-hover"
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
