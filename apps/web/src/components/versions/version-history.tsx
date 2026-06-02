"use client";

import { useState, useEffect, useRef } from "react";
import { VersionNode } from "./version-node";
import { VersionCompare } from "./version-compare";
import { ExportActionCenter } from "./export-action-center";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { UsageSummary } from "@/components/activity/usage-summary";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ThinkingLoader } from "@/components/ui/skeleton";
import { getSnapshots, getSnapshotDiff } from "@/lib/api";
import type { SnapshotInfo, VersionDiff } from "@/lib/api";

interface VersionHistoryProps {
  sessionId: string;
}

export function VersionHistory({ sessionId }: VersionHistoryProps) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getSnapshots(sessionId);
        const items = result.data ?? [];
        setSnapshots(items);
        if (items.length > 0 && !hasAutoSelectedRef.current) {
          hasAutoSelectedRef.current = true;
          const latest = items.reduce((a, b) => (a.version > b.version ? a : b));
          setSelectedId(latest.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load versions");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    if (!selectedId || !compareId) {
      setDiff(null);
      return;
    }
    const loadDiff = async () => {
      setDiffLoading(true);
      setDiffError("");
      try {
        const result = await getSnapshotDiff(selectedId, compareId);
        setDiff(result);
      } catch (e) {
        setDiffError(e instanceof Error ? e.message : "Failed to load comparison");
      } finally {
        setDiffLoading(false);
      }
    };
    loadDiff();
  }, [selectedId, compareId]);

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setCompareId(null);
      return;
    }
    if (!selectedId) {
      setSelectedId(id);
    } else if (!compareId) {
      const newIsAfter =
        snapshots.find((s) => s.id === id)!.version > snapshots.find((s) => s.id === selectedId)!.version;
      if (newIsAfter) {
        setCompareId(id);
      } else {
        setCompareId(selectedId);
        setSelectedId(id);
      }
    } else {
      setSelectedId(id);
      setCompareId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ThinkingLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-6 text-center">
        <p className="text-accent-red">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded bg-accent-purple px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.version - b.version);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Projects", href: "/projects" }, { label: "Version History" }]} />

      <StepIndicator current="review" complete={["interview"]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Version History</h1>
          <p className="mt-1 text-xs text-text-secondary">
            {sorted.length} snapshot{sorted.length !== 1 ? "s" : ""} — Click a snapshot to export, or select
            two to compare
          </p>
        </div>
      </div>

      {selectedId && !compareId && (
        <div className="rounded border border-accent-purple-dim bg-accent-purple-dim/30 p-3 text-xs text-accent-purple">
          Select a second version to compare. The later version will be compared against this one.
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded border-2 border-dashed border-border-default bg-bg-surface p-12 text-center">
          <p className="text-sm font-medium text-text-primary">No versions yet</p>
          <p className="mt-1 text-xs text-text-secondary">
            Complete the interview and generate a plan to create the first snapshot.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {sorted.map((snapshot, i) => {
              const parent = snapshot.parentSnapshotId
                ? sorted.find((s) => s.id === snapshot.parentSnapshotId)
                : null;
              return (
                <VersionNode
                  key={snapshot.id}
                  snapshot={snapshot}
                  isSelected={selectedId === snapshot.id}
                  isCompareTarget={compareId === snapshot.id}
                  onSelect={handleSelect}
                  parentVersion={parent?.version ?? null}
                  isFirst={i === 0}
                  isLast={i === sorted.length - 1}
                />
              );
            })}
          </div>

          <div className="lg:col-span-3">
            {diffLoading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <ThinkingLoader />
              </div>
            )}
            {diffError && (
              <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-4 text-sm text-accent-red">
                {diffError}
              </div>
            )}
            {diff && !diffLoading && <VersionCompare diff={diff} />}
            {!diff && !diffLoading && !diffError && selectedId && compareId && (
              <div className="flex h-full items-center justify-center rounded border-2 border-dashed border-border-default p-12 text-center">
                <p className="text-sm text-text-secondary">Select a second version to see what changed.</p>
              </div>
            )}
            {!diff && !diffLoading && !diffError && selectedId && !compareId && snapshots.length > 0 && (
              <div className="rounded border border-border-default bg-bg-elevated p-5">
                <ExportActionCenter snapshot={snapshots.find((s) => s.id === selectedId)!} />
              </div>
            )}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="space-y-6 border-t border-border-subtle pt-6">
          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary hover:text-accent-purple">
              ▸ Activity timeline
            </summary>
            <div className="mt-3">
              <ActivityTimeline projectId={sessionId} compact />
            </div>
          </details>

          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary hover:text-accent-purple">
              ▸ Usage summary
            </summary>
            <div className="mt-3">
              <UsageSummary projectId={sessionId} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
