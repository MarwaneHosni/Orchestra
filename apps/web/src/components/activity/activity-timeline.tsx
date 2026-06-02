"use client";

import { useState, useEffect } from "react";
import { getProjectActivity, getEventLabel } from "@/lib/api";
import type { ActivityEvent } from "@/lib/api";
import { ThinkingLoader } from "@/components/ui/skeleton";

interface ActivityTimelineProps {
  projectId: string;
  compact?: boolean;
}

export function ActivityTimeline({ projectId, compact }: ActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getProjectActivity(projectId);
        setEvents(result.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3" role="status" aria-label="Loading activity">
        <ThinkingLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-3 text-sm text-accent-red" role="alert">
        {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded border-2 border-dashed border-border-default bg-bg-surface p-8 text-center text-xs text-text-secondary">
        No activity recorded yet
      </div>
    );
  }

  const displayEvents = compact ? events.slice(0, 10) : events;

  return (
    <div className="space-y-1.5">
      {displayEvents.map((event, i) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-accent-purple" />
            {i < displayEvents.length - 1 && <div className="flex-1 w-0.5 bg-border-subtle" />}
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <p className="text-sm text-text-primary">{getEventLabel(event.eventType)}</p>
            <p className="text-xs text-text-secondary">
              {new Date(event.timestamp).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}
      {compact && events.length > 10 && (
        <p className="text-xs text-text-secondary pt-2">{events.length - 10} more events</p>
      )}
    </div>
  );
}
