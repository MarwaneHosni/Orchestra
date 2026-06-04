"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TerminalTitle } from "@/components/ui/terminal-title";
import { listProjects, deleteProject } from "@/lib/api";
import type { ProjectRecord } from "@/lib/api";

function BtnLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ borderRadius: 3, padding: "8px 18px", fontSize: 13, fontFamily: "inherit", color: "#fff" }}
      className="inline-flex bg-accent-purple text-white border border-accent-purple font-medium hover:opacity-88 active:scale-[0.98] transition-[color,background-color,border-color,opacity,transform] duration-150"
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeleting(id);
    setPendingDelete(null);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setDeleting(null);
    }
  }

  function handleDeleteClick(id: string, name: string) {
    setPendingDelete({ id, name });
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <TerminalTitle className="text-lg font-semibold text-text-primary">Projects</TerminalTitle>
            <p className="mt-2 text-xs text-text-secondary">Loading projects...</p>
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
            <TerminalTitle className="text-lg font-semibold text-text-primary">Projects</TerminalTitle>
            <p className="mt-2 text-xs text-text-secondary">
              All your software ideas, organised as projects.
            </p>
          </div>
          <BtnLink href="/projects/new">New project</BtnLink>
        </div>
        <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-6 text-center" role="alert">
          <p className="text-accent-red">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-6">
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
            <TerminalTitle className="text-lg font-semibold text-text-primary">Projects</TerminalTitle>
            <p className="mt-2 text-xs text-text-secondary">
              All your software ideas, organised as projects.
            </p>
          </div>
          <BtnLink href="/projects/new">New project</BtnLink>
        </div>
        <div className="flex flex-col items-center justify-center rounded border-2 border-dashed border-border-default bg-bg-surface px-6 py-16 text-center">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">No projects yet</h3>
          <p className="mb-6 max-w-sm text-xs text-text-secondary">
            Create your first project to start transforming an idea into a structured development plan.
          </p>
          <BtnLink href="/projects/new">Create project</BtnLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <TerminalTitle className="text-lg font-semibold text-text-primary">Projects</TerminalTitle>
          <p className="mt-2 text-xs text-text-secondary">All your software ideas, organised as projects.</p>
        </div>
        <BtnLink href="/projects/new">New project</BtnLink>
      </div>

      <ul className="space-y-4">
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
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(project.id, project.name); }}
                  disabled={deleting === project.id}
                  style={{ borderRadius: 2, padding: "2px 8px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--color-border-default)", color: "var(--color-text-muted)", background: "transparent", cursor: "pointer" }}
                  className="hover:border-accent-red-dim hover:text-accent-red"
                  aria-label={`Delete ${project.name}`}
                >
                  [ delete ]
                </button>
                <span className="text-sm text-accent-purple" aria-hidden="true">
                  {project.status === "draft" ? "Start interview" : "Continue"}
                  &nbsp;→
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <div style={{
            border: "1px solid var(--color-border-default)",
            borderRadius: 3,
            background: "var(--color-bg-elevated)",
            padding: "24px 28px",
            maxWidth: 420,
            width: "90%",
          }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 10 }}>
              Delete project?
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 6 }}>
              <span style={{ color: "var(--color-accent-red)" }}>"{pendingDelete.name}"</span> will be permanently removed along with all associated data.
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 20 }}>
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPendingDelete(null)}
                style={{
                  borderRadius: 3, padding: "8px 16px", fontSize: 13, fontFamily: "inherit",
                  border: "1px solid var(--color-border-default)", background: "transparent",
                  color: "var(--color-text-secondary)", cursor: "pointer",
                }}
                className="hover:border-border-strong hover:text-text-primary transition-colors duration-150"
              >
                [ cancel ]
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting === pendingDelete.id}
                style={{
                  borderRadius: 3, padding: "8px 16px", fontSize: 13, fontFamily: "inherit",
                  border: "1px solid var(--color-accent-red)", background: "transparent",
                  color: "var(--color-accent-red)", cursor: deleting === pendingDelete.id ? "not-allowed" : "pointer",
                  opacity: deleting === pendingDelete.id ? 0.6 : 1,
                }}
                className="hover:bg-accent-red-dim transition-colors duration-150"
              >
                {deleting === pendingDelete.id ? "[ deleting... ]" : "[ delete ]"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
