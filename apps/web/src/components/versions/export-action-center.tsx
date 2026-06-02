"use client";

import { useState, useEffect } from "react";
import { exportArtifact, getExports, triggerDownload } from "@/lib/api";
import type { ExportRecord, SnapshotInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ExportActionCenterProps {
  snapshot: SnapshotInfo;
}

type ExportType = ExportRecord["type"];
type ExportFormat = ExportRecord["format"];

const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  blueprint: "Blueprint",
  task_graph: "Task Graph",
  prompts: "AI Prompts",
  full_bundle: "Full Bundle",
};

const EXPORT_TYPE_DESC: Record<ExportType, string> = {
  blueprint: "Project plan overview with phase status, assumptions, constraints, and risks",
  task_graph: "Complete task dependency graph with all tasks grouped by phase",
  prompts: "All AI execution prompts with task context and ordering",
  full_bundle: "Combined blueprint + task graph + prompts in a single document",
};

export function ExportActionCenter({ snapshot }: ExportActionCenterProps) {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getExports(snapshot.id);
        setExports(result.data ?? []);
      } catch {
        // exports list is non-critical
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [snapshot.id]);

  const handleExport = async (type: ExportType) => {
    setExporting(type);
    setError("");
    try {
      const record = await exportArtifact(snapshot.id, type, format);
      setExports((prev) => [record, ...prev]);
      triggerDownload(record.content, filename(snapshot, type, format), format);
      const label = EXPORT_TYPE_LABELS[type];
      setSuccessMessage(`${label} exported successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleRedownload = (record: ExportRecord) => {
    triggerDownload(record.content, filename(snapshot, record.type, record.format), record.format);
  };

  const handleCopy = async (record: ExportRecord) => {
    try {
      await navigator.clipboard.writeText(record.content);
    } catch {
      // clipboard may be unavailable
    }
  };

  const exportTypes: ExportType[] = ["blueprint", "task_graph", "prompts", "full_bundle"];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Export</h3>
        <p className="mt-1 text-xs text-text-secondary">
          v{snapshot.version} — {snapshot.reason}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-text-secondary">Format:</span>
        <button
          onClick={() => setFormat("markdown")}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            format === "markdown"
              ? "bg-accent-purple text-white"
              : "border border-border-default bg-bg-surface text-text-secondary hover:bg-bg-hover",
          )}
        >
          Markdown
        </button>
        <button
          onClick={() => setFormat("json")}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            format === "json"
              ? "bg-accent-purple text-white"
              : "border border-border-default bg-bg-surface text-text-secondary hover:bg-bg-hover",
          )}
        >
          JSON
        </button>
      </div>

      <div className="space-y-3">
        {exportTypes.map((type) => {
          const isExporting = exporting === type;
          const existing = exports.find((e) => e.type === type && e.format === format);

          return (
            <div key={type} className="rounded border border-border-default bg-bg-elevated p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{EXPORT_TYPE_LABELS[type]}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{EXPORT_TYPE_DESC[type]}</p>
                </div>
                <button
                  onClick={() => handleExport(type)}
                  disabled={isExporting}
                  className={cn(
                    "shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors",
                    isExporting
                      ? "bg-border-subtle text-text-muted"
                      : "bg-accent-purple text-white hover:opacity-90",
                  )}
                >
                  {isExporting ? "Exporting..." : "Export"}
                </button>
              </div>

              {existing && (
                <div className="mt-2 flex items-center gap-3 border-t border-border-subtle pt-2 text-xs">
                  <span className="text-text-secondary">
                    Exported {new Date(existing.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRedownload(existing)}
                    className="text-accent-purple hover:underline"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleCopy(existing)}
                    className="text-accent-purple hover:underline"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {successMessage && (
        <div className="rounded border border-accent-green-dim bg-accent-green-dim/30 p-3 text-xs text-accent-green" role="status">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-3 text-xs text-accent-red" role="alert">
          {error}
        </div>
      )}

      {!loading && exports.length > 0 && (
        <div className="border-t border-border-subtle pt-3">
          <p className="mb-2 text-xs font-medium text-text-secondary">All exports for this snapshot</p>
          <div className="space-y-1">
            {exports.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded bg-bg-surface px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium text-text-primary">{EXPORT_TYPE_LABELS[record.type]}</span>
                  <span className="ml-2 text-text-secondary">
                    ({record.format}) — v{record.snapshotVersion}
                  </span>
                  <span className="ml-2 text-text-secondary">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRedownload(record)}
                    className="text-accent-purple hover:underline"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleCopy(record)}
                    className="text-accent-purple hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function filename(snapshot: SnapshotInfo, type: ExportType, fmt: ExportFormat): string {
  const ext = fmt === "json" ? "json" : "md";
  return `orchestra-v${snapshot.version}-${type}.${ext}`;
}
