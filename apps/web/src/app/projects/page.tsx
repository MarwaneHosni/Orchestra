"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/api";
import type { ProjectRecord } from "@/lib/api";

function BtnLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors"
    >
      {children}
    </Link>
  );
}

const STATUS_DOTS: Record<string, string> = {
  draft: "bg-text-muted",
  active: "bg-accent-purple",
  in_progress: "bg-accent-purple",
  blueprint_ready: "bg-accent-green",
  complete: "bg-accent-green",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-bg-hover text-text-secondary" },
  active: { label: "Active", color: "bg-accent-purple-dim text-accent-purple" },
  in_progress: { label: "In Progress", color: "bg-accent-purple-dim text-accent-purple" },
  blueprint_ready: { label: "Blueprint Ready", color: "bg-accent-green-dim text-accent-green" },
  complete: { label: "Complete", color: "bg-accent-green-dim text-accent-green" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8" m-20>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-xs text-text-secondary">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-xs text-text-secondary">
              All your software ideas, organised as projects.
            </p>
          </div>
          <Link href="/projects/new">
            <Button>New project</Button>
          </Link>
        </div>
        <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-6 text-center" role="alert">
          <p className="text-accent-red">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-xs text-text-secondary">
              All your software ideas, organised as projects.
            </p>
          </div>
          <Link href="/projects/new">
            <Button>New project</Button>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded border-2 border-dashed border-border-default bg-bg-surface px-6 py-16 text-center">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">No projects yet</h3>
          <p className="mb-6 max-w-sm text-xs text-text-secondary">
            Create your first project to start transforming an idea into a structured development plan.
          </p>
          <Link href="/projects/new">
            <Button>Create project</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
          <p className="mt-1 text-xs text-text-secondary">All your software ideas, organised as projects.</p>
        </div>
        <Link href="/projects/new">
          <Button>New project</Button>
        </Link>
      </div>

      <ul className="space-y-3">
        {projects.map((project) => {
          const dotColor = STATUS_DOTS[project.status] ?? "bg-text-muted";
          const badge = STATUS_LABELS[project.status] ?? STATUS_LABELS.draft;
          const statusLabel = STATUS_LABELS[project.status]?.label ?? "Draft";
          return (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}/interview`}
                className="flex items-center gap-5 rounded border border-border-default bg-bg-elevated px-5 py-4 transition-colors hover:bg-bg-hover"
                aria-label={`${project.name}, ${statusLabel}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
                <span className="sr-only">Status: {statusLabel}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{project.name}</p>
                  <p className="text-xs text-text-secondary">{formatDate(project.createdAt)}</p>
                </div>
                <span className={`rounded px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                  {badge.label}
                </span>
                <span className="text-sm text-accent-purple" aria-hidden="true">
                  {project.status === "draft" ? "Start interview" : "Continue"}
                  &nbsp;→
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
