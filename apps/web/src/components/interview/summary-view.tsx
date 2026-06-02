"use client";

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLatestBlueprint } from "@/lib/api";
import type { BlueprintResult } from "@/lib/api";
import { ThinkingLoader } from "@/components/ui/skeleton";

interface SummaryViewProps {
  sessionId: string;
}

const MAX_POLL_RETRIES = 60;
const POLL_INTERVAL_MS = 2000;

function confidenceColor(n: number): string {
  const pct = n * 100;
  if (pct >= 60) return "var(--color-accent-green)";
  if (pct >= 40) return "var(--color-accent-amber)";
  return "var(--color-accent-red)";
}

function statusColor(s: string): string {
  if (s === "sufficient") return "var(--color-accent-green)";
  if (s === "insufficient") return "var(--color-accent-amber)";
  return "var(--color-text-muted)";
}

function statusIcon(s: string): string {
  if (s === "sufficient") return "✓";
  if (s === "insufficient") return "~";
  return "○";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SummaryView({ sessionId }: SummaryViewProps) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState<BlueprintResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pollRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    pollRef.current = 0;

    const poll = async () => {
      while (!cancelled) {
        try {
          const result = await getLatestBlueprint(sessionId);
          if (cancelled) return;
          if (result) {
            setBlueprint(result);
            setLoading(false);
            return;
          }
        } catch (e) {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Failed to load blueprint");
          setLoading(false);
          return;
        }

        pollRef.current++;
        if (pollRef.current >= MAX_POLL_RETRIES) {
          if (!cancelled) {
            setError("Blueprint generation timed out. Please try again.");
            setLoading(false);
          }
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3" role="status" aria-label="Loading blueprint">
        <ThinkingLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ borderRadius: 3, border: "1px solid var(--color-accent-red-dim)", background: "var(--color-accent-red-dim)", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "var(--color-accent-red)", fontSize: 14 }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 14, borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit" }}
          className="bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>No blueprint found for this project.</p>
      </div>
    );
  }

  const hasInsufficientPhases = blueprint.phases.some(
    (p) => p.status === "insufficient" || p.status === "missing",
  );

  const C = confidenceColor(blueprint.overallConfidence);

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
      {/* ── Header: terminal prompt line ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 10,
          borderBottom: "1px solid #222",
          fontSize: 13,
          color: "var(--color-text-secondary)",
        }}
      >
        <span>
          <span style={{ color: "var(--color-accent-purple)" }}>orchestra</span>
          <span style={{ color: "#555" }}> / </span>
          <span>projects</span>
          <span style={{ color: "#555" }}> / </span>
          <span style={{ color: "var(--color-text-primary)" }}>plan v{blueprint.planVersion}</span>
        </span>
        <span style={{ fontSize: 12, color: "#666" }}>
          generated: {formatDate(blueprint.generatedAt)}
        </span>
      </div>

      {/* ── Status banner ── */}
      {hasInsufficientPhases && (
        <div
          style={{
            borderLeft: "3px solid var(--color-accent-amber)",
            background: "color-mix(in srgb, var(--color-accent-amber) 5%, transparent)",
            padding: "10px 14px",
            marginTop: 16,
            fontSize: 13,
            color: "var(--color-text-secondary)",
          }}
        >
          some phases have insufficient detail.{" "}
          <code
            style={{
              background: "transparent",
              border: "1px solid var(--color-accent-amber)",
              borderRadius: 2,
              padding: "1px 5px",
              fontFamily: "inherit",
              fontSize: 12,
              color: "var(--color-accent-amber)",
            }}
          >
            needs_review
          </code>{" "}
          markers will appear in the task graph for these areas. you can revisit the interview to add more detail.
        </div>
      )}

      {/* ── Metrics bar ── */}
      <div
        style={{
          borderTop: "1px solid #222",
          borderBottom: "1px solid #222",
          padding: "12px 0",
          marginTop: 16,
          fontSize: 13,
        }}
        className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0"
      >
        <span className="flex items-center gap-1">
          <span style={{ color: "#666" }}>confidence:</span>
          <span style={{ color: C, fontWeight: 600 }}>
            {Math.round(blueprint.overallConfidence * 100)}%
          </span>
          <span style={{ color: "#444" }} className="hidden sm:inline mx-[10px]">|</span>
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "#666" }}>
            phases: <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{blueprint.phases.length}</span>
          </span>
          <span style={{ color: "#444" }} className="hidden sm:inline mx-[10px]">|</span>
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: "#666" }}>
            flags:{" "}
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
              {(blueprint.ambiguityFlags ?? []).length}
            </span>{" "}
            ambiguity items
          </span>
        </span>
      </div>

      {/* ── Phase Progress ── */}
      <section style={{ marginTop: 32 }}>
        <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <span>── phase progress</span>
          <span style={{ flex: 1, borderTop: "1px solid #222", display: "inline-block" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          {(blueprint.phases ?? []).map((phase) => {
            const col = statusColor(phase.status);
            return (
              <div
                key={phase.phaseType}
                className="summary-phase-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid #1a1a1a",
                  fontSize: 13,
                  cursor: "default",
                }}
              >
                <span style={{ width: 18, flexShrink: 0, textAlign: "center", color: col }}>
                  {statusIcon(phase.status)}
                </span>
                <span
                  style={{
                    color: "var(--color-text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flexShrink: 0,
                  }}
                >
                  {phase.phaseName}
                </span>
                {/* dot leader */}
                <span
                  style={{
                    flex: 1,
                    minWidth: 8,
                    overflow: "hidden",
                    color: "#333",
                    fontSize: 12,
                    textAlign: "left",
                    padding: "0 4px",
                  }}
                  className="hidden sm:block"
                >
                  {"·".repeat(80)}
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, color: col, marginRight: 12 }}>
                  [{phase.status}]
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    width: 48,
                    textAlign: "right",
                    color: confidenceColor(phase.confidence),
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {Math.round(phase.confidence * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Assumptions ── */}
      {blueprint.assumptions?.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>── assumptions ({blueprint.assumptions.length})</span>
            <span style={{ flex: 1, borderTop: "1px solid #222", display: "inline-block" }} />
          </div>
          <div style={{ marginTop: 10 }}>
            {blueprint.assumptions.map((a, i) => (
              <div
                key={i}
                style={{
                  borderLeft: "2px solid #2a2a2a",
                  padding: "8px 0 8px 14px",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.6,
                }}
              >
                <p>{a.description}</p>
                <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  source: {a.source}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Constraints ── */}
      {blueprint.constraints?.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>── constraints ({blueprint.constraints.length})</span>
            <span style={{ flex: 1, borderTop: "1px solid #222", display: "inline-block" }} />
          </div>
          <div style={{ marginTop: 10 }}>
            {blueprint.constraints.map((c, i) => (
              <div
                key={i}
                style={{
                  borderLeft: "2px solid #2a2a2a",
                  padding: "8px 0 8px 14px",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.6,
                }}
              >
                <p>{c.description}</p>
                <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  source: {c.source}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Risks ── */}
      {blueprint.risks?.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>── risks ({blueprint.risks.length})</span>
            <span style={{ flex: 1, borderTop: "1px solid #222", display: "inline-block" }} />
          </div>
          <div style={{ marginTop: 10 }}>
            {blueprint.risks.map((r, i) => (
              <div
                key={i}
                style={{
                  borderLeft: "2px solid #c0392b",
                  padding: "8px 0 8px 14px",
                  fontSize: 13,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.6,
                }}
              >
                <p>{r.description}</p>
                <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  source: {r.source}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Ambiguity Flags ── */}
      {(blueprint.ambiguityFlags ?? []).length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>── flags ({blueprint.ambiguityFlags.length})</span>
            <span style={{ flex: 1, borderTop: "1px solid #222", display: "inline-block" }} />
          </div>
          <div style={{ marginTop: 10 }}>
            {blueprint.ambiguityFlags.map((f, i) => {
              const flagBorder =
                f.severity === "high" ? "#c0392b" :
                f.severity === "medium" ? "var(--color-accent-amber)" :
                "#555";
              return (
                <div
                  key={i}
                  style={{
                    borderLeft: `2px solid ${flagBorder}`,
                    padding: "8px 0 8px 14px",
                    fontSize: 13,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.6,
                  }}
                >
                  <p>
                    <code style={{ fontSize: 12, color: flagBorder, fontFamily: "inherit" }}>{f.type}:</code>{" "}
                    {f.message}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Bottom action bar ── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          borderTop: "1px solid #222",
          paddingTop: 16,
          marginTop: 32,
          paddingBottom: 8,
        }}
        className="flex-col sm:flex-row"
      >
        <button
          onClick={() => router.push(`/projects/${sessionId}/tasks`)}
          style={{
            borderRadius: 3,
            padding: "8px 20px",
            fontSize: 13,
            fontFamily: "inherit",
            border: "1px solid #7c3aed",
            color: "#7c3aed",
            background: "transparent",
            cursor: "pointer",
          }}
          className="hover:bg-[rgba(124,58,237,0.1)] transition-colors duration-150"
        >
          [ view task graph ]
        </button>
        <button
          onClick={() => router.push(`/projects/${sessionId}/versions`)}
          style={{
            borderRadius: 3,
            padding: "8px 20px",
            fontSize: 13,
            fontFamily: "inherit",
            border: "1px solid #333",
            color: "var(--color-text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
          className="hover:border-[#555] hover:text-text-primary transition-colors duration-150"
        >
          [ exports & versions ]
        </button>
        <button
          onClick={() => router.push(`/projects/${sessionId}/interview`)}
          style={{
            borderRadius: 3,
            padding: "8px 20px",
            fontSize: 13,
            fontFamily: "inherit",
            border: "1px solid #333",
            color: "var(--color-text-secondary)",
            background: "transparent",
            cursor: "pointer",
          }}
          className="hover:border-[#555] hover:text-text-primary transition-colors duration-150"
        >
          [ ← return to interview ]
        </button>
      </div>
    </div>
  );
}
