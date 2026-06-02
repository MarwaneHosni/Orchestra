"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFocusTrap, useEscapeToClose } from "@/lib/use-focus-trap";
import { LiveAnnouncer } from "@/components/ui/live-announcer";
import { LoadingBlock } from "@/components/ui/skeleton";
import { getApiBaseUrl } from "@/lib/api-config";

interface PromptPreviewProps {
  taskId: string;
  sessionId: string;
  onClose: () => void;
}

interface ParsedSection {
  id: string;
  heading: string;
  content: string;
  subSections: { heading: string; content: string }[];
}

const SECTION_ORDER = [
  "Objective",
  "Context",
  "Constraints",
  "Expected Output",
  "Validation Criteria",
  "Architectural Alignment",
  "Agent Tips",
];

function parsePrompt(markdown: string | null | undefined): ParsedSection[] {
  if (!markdown) return [];
  const sections: ParsedSection[] = [];
  const lines = markdown.split("\n");
  let currentHeading = "";
  let currentContent: string[] = [];
  let currentSubHeading = "";
  let currentSubContent: string[] = [];
  const subs: { heading: string; content: string }[] = [];

  function flushSub() {
    if (currentSubHeading) {
      subs.push({ heading: currentSubHeading, content: currentSubContent.join("\n").trim() });
      currentSubContent = [];
      currentSubHeading = "";
    }
  }

  function flushSection() {
    flushSub();
    if (currentHeading) {
      sections.push({
        id: currentHeading.toLowerCase().replace(/\s+/g, "-"),
        heading: currentHeading,
        content: currentContent.join("\n").trim(),
        subSections: [...subs],
      });
      subs.length = 0;
      currentContent = [];
    }
  }

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h2Match) {
      flushSection();
      currentHeading = h2Match[1]!.trim();
    } else if (h3Match && currentHeading) {
      flushSub();
      currentSubHeading = h3Match[1]!.trim();
    } else if (currentSubHeading) {
      currentSubContent.push(line);
    } else if (currentHeading) {
      currentContent.push(line);
    }
  }
  flushSection();

  const orderMap = new Map(SECTION_ORDER.map((h, i) => [h, i]));
  sections.sort((a, b) => {
    const ai = orderMap.get(a.heading) ?? 99;
    const bi = orderMap.get(b.heading) ?? 99;
    return ai - bi;
  });

  return sections;
}

function renderContent(text: string): React.ReactNode {
  if (!text) return <span className="text-text-muted italic">(empty)</span>;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="mb-3 overflow-x-auto p-3 text-xs border-l-2 border-accent-purple" style={{ background: "var(--color-bg-elevated)", borderRadius: 0 }}>
            {codeLines.join("\n")}
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={i} className="mb-1 mt-3 text-xs font-semibold text-text-secondary">
          {line.slice(5)}
        </h4>,
      );
    } else if (line.match(/^\s*[-*]\s+/)) {
      const item = line.replace(/^\s*[-*]\s+/, "");
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm text-text-primary">
          {item}
        </li>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed text-text-primary">
          {line}
        </p>,
      );
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre key="code-end" className="mb-3 overflow-x-auto p-3 text-xs border-l-2 border-accent-purple" style={{ background: "var(--color-bg-elevated)", borderRadius: 0 }}>
        {codeLines.join("\n")}
      </pre>,
    );
  }

  return elements;
}

export function PromptPreview({ taskId, sessionId, onClose }: PromptPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(SECTION_ORDER.map((h) => h.toLowerCase().replace(/\s+/g, "-"))));
  const [activeSection, setActiveSection] = useState<string>("");

  const parsed = useMemo(() => (prompt ? parsePrompt(prompt) : []), [prompt]);

  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(panelRef, true);
  useEscapeToClose(close, true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/plans/plan-${sessionId}/tasks/${taskId}/prompt`);
        if (!res.ok) throw new Error("Failed to load prompt");
        const data = await res.json();
        setPrompt(data.promptText ?? null);
        setAnnouncement("Prompt loaded");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setAnnouncement("Failed to load prompt");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [taskId, sessionId]);

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setAnnouncement("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setAnnouncement("Could not copy prompt");
    }
  };

  const toggleSection = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const el = sectionsRef.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Execution prompt"
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border-default bg-bg-elevated sm:w-[42rem]"
    >
      <LiveAnnouncer message={announcement} />

      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Execution Prompt</h2>
        <div className="flex items-center gap-3">
          {prompt && (
            <button
              onClick={handleCopy}
              aria-label="Copy prompt to clipboard"
              className="rounded border border-border-default px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-accent-purple"
            >
              {copied ? "Copied!" : "Copy raw"}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close prompt preview"
            className="rounded p-1 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
          >
            <span aria-hidden="true">✗</span>
          </button>
        </div>
      </div>

      {parsed.length > 0 && (
        <nav
          aria-label="Section navigation"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border-subtle px-3 py-2"
        >
          {parsed.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-purple ${
                activeSection === section.id
                  ? "bg-accent-purple text-white"
                  : "bg-bg-hover text-text-secondary hover:bg-bg-selected"
              }`}
            >
              {section.heading}
            </button>
          ))}
        </nav>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <LoadingBlock />
        )}
        {!loading && error && (
          <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-4 text-sm text-accent-red" role="alert">
            {error}
          </div>
        )}
        {!loading && !error && parsed.length === 0 && prompt && (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
            {prompt}
          </pre>
        )}
        {!loading && !error && parsed.length > 0 && (
          <div className="space-y-4">
            {parsed.map((section) => (
              <div
                key={section.id}
                ref={(el) => {
                  if (el) sectionsRef.current.set(section.id, el);
                  else sectionsRef.current.delete(section.id);
                }}
                className="rounded border border-border-default"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={expanded.has(section.id)}
                  className="flex w-full items-center justify-between rounded-t px-4 py-3 text-left hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-purple"
                >
                  <span className="text-sm font-semibold text-text-primary">{section.heading}</span>
                  <span
                    className={`text-xs text-text-secondary transition-transform ${expanded.has(section.id) ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </button>
                {expanded.has(section.id) && (
                  <div className="border-t border-border-subtle px-4 py-3">
                    {section.subSections.length > 0 ? (
                      <div className="space-y-4">
                        {section.subSections.map((sub) => (
                          <div key={sub.heading}>
                            <h4 className="mb-1 text-xs font-semibold text-text-secondary">{sub.heading}</h4>
                            <div className="space-y-1">{renderContent(sub.content)}</div>
                          </div>
                        ))}
                        {section.content && (
                          <div className="pt-2">{renderContent(section.content)}</div>
                        )}
                      </div>
                    ) : (
                      renderContent(section.content)
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
