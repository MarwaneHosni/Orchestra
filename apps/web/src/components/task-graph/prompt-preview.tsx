"use client";

import { useState, useEffect, useMemo } from "react";
import { getApiBaseUrl } from "@/lib/api-config";
import { ThinkingLoader } from "@/components/ui/skeleton";

interface PromptPreviewProps {
  taskId: string;
  sessionId: string;
  onClose: () => void;
}

interface ParsedSection {
  id: string;
  heading: string;
  content: string;
  lines: string[];
}

const SECTION_ORDER = [
  "Objective", "Context", "Constraints", "Expected Output",
  "Validation Criteria", "Architectural Alignment", "Agent Tips",
];

function parsePrompt(markdown: string | null | undefined): ParsedSection[] {
  if (!markdown) return [];
  const sections: ParsedSection[] = [];
  const lines = markdown.split("\n");
  let currentHeading = "";
  let currentLines: string[] = [];

  function flush() {
    if (currentHeading) {
      sections.push({
        id: currentHeading.toLowerCase().replace(/\s+/g, "-"),
        heading: currentHeading,
        content: currentLines.join("\n").trim(),
        lines: [...currentLines],
      });
      currentLines = [];
    }
  }

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { flush(); currentHeading = h2[1]!.trim(); continue; }
    if (currentHeading) currentLines.push(line);
  }
  flush();

  const orderMap = new Map(SECTION_ORDER.map((h, i) => [h, i]));
  sections.sort((a, b) => (orderMap.get(a.heading) ?? 99) - (orderMap.get(b.heading) ?? 99));
  return sections;
}

function SectionContent({ section }: { section: ParsedSection }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-text-secondary)", padding: "0 20px 16px" }}>
      {section.lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;

        // Code blocks
        if (line.startsWith("```")) return null;
        const isInCode = section.content.includes("```");
        if (isInCode) return <div key={i} style={{ background: "var(--color-bg-surface)", padding: "12px 16px", borderRadius: 3, fontFamily: "inherit", fontSize: 12, overflowX: "auto" }}>{line}</div>;

        // Bullet list
        const bullet = line.match(/^\s*-\s+(.+)/);
        if (bullet) {
          return <div key={i} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>·</span>
            <span>{bullet[1]}</span>
          </div>;
        }

        // Numbered list (for Constraints, Validation Criteria etc)
        const num = line.match(/^\s*(\d+)\.\s+(.+)/);
        if (num) {
          return <div key={i} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "var(--color-text-muted)", flexShrink: 0, minWidth: 24, textAlign: "right" }}>{num[1]}.</span>
            <span>{num[2]}</span>
          </div>;
        }

        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export function PromptPreview({ taskId, sessionId, onClose }: PromptPreviewProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["objective"]));
  const [activeTab, setActiveTab] = useState<string>("objective");

  const parsed = useMemo(() => (prompt ? parsePrompt(prompt) : []), [prompt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/tasks/${taskId}/prompt`);
        if (!res.ok) throw new Error("Failed to load prompt");
        const data = await res.json();
        if (!cancelled) setPrompt(data.promptText ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId, sessionId]);

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleSection = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTab = (id: string) => {
    setActiveTab(id);
    setExpanded((prev) => new Set(prev).add(id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border-default)", padding: "16px 20px", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Execution Prompt</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {prompt && (
            <button onClick={handleCopy}
              style={{ border: "1px solid var(--color-border-default)", borderRadius: 2, padding: "2px 7px", fontSize: 12, fontFamily: "inherit", color: copied ? "var(--color-accent-green)" : "var(--color-text-secondary)", background: "transparent", cursor: "pointer" }}
              className="hover:text-text-primary hover:border-border-strong"
            >
              {copied ? "✓ copied" : "[ copy raw ]"}
            </button>
          )}
          <button onClick={onClose} aria-label="Close prompt"
            style={{ border: "1px solid var(--color-border-default)", borderRadius: 2, padding: "2px 7px", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-secondary)", background: "transparent", cursor: "pointer" }}
            className="hover:text-text-primary hover:border-border-strong"
          >
            ✗
          </button>
        </div>
      </div>

      {/* Section tabs */}
      {!loading && parsed.length > 0 && (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-border-default)", padding: "0 20px", overflowX: "auto", flexShrink: 0, scrollbarWidth: "none" } as any}>
          {parsed.map((s) => (
            <button key={s.id} onClick={() => selectTab(s.id)}
              style={{
                padding: "10px 14px", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                color: activeTab === s.id ? "var(--color-text-primary)" : "var(--color-text-muted)",
                borderBottom: activeTab === s.id ? "2px solid var(--color-accent-purple)" : "2px solid transparent",
                marginBottom: -1, background: "transparent", whiteSpace: "nowrap", borderTop: "none", borderLeft: "none", borderRight: "none",
              }}
              className="hover:text-text-secondary"
            >
              {s.heading.length > 12 ? s.heading.slice(0, 10) + ".." : s.heading}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <ThinkingLoader />
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 20, fontSize: 13, color: "var(--color-accent-red)" }}>{error}</div>
        )}
        {!loading && !error && parsed.length > 0 && (
          <div>
            {parsed.map((section) => {
              const isExpanded = expanded.has(section.id);
              return (
                <div key={section.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <button onClick={() => toggleSection(section.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 20px", fontSize: 13, fontWeight: 500, fontFamily: "inherit", color: "var(--color-text-primary)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                    className="hover:bg-bg-hover"
                  >
                    <span>{section.heading}</span>
                    <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{isExpanded ? "▾" : "▸"}</span>
                  </button>
                  {isExpanded && <SectionContent section={section} />}
                </div>
              );
            })}
          </div>
        )}
        {!loading && !error && !prompt && (
          <div style={{ padding: 20, fontSize: 13, color: "var(--color-text-muted)" }}>No prompt data available.</div>
        )}
      </div>
    </div>
  );
}
