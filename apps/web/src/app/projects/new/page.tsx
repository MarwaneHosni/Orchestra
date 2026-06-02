"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [ideaText, setIdeaText] = useState("");
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await createProject(ideaText.trim(), projectName.trim() || undefined);
      router.push(`/projects/${result.sessionId}/interview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">New project</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Describe your software idea. Orchestra will guide you through structured questions to build a plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>Provide a name and a brief description of your idea.</CardDescription>
        </CardHeader>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <FormField label="Project name" description="A short, descriptive name for your project.">
            {(id, _errorId, descriptionId) => (
              <Input
                id={id}
                aria-describedby={descriptionId}
                placeholder="e.g. My SaaS Platform"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Idea description"
            required
            description="What problem does your software solve? Describe your idea in a few sentences."
          >
            {(id, errorId, descriptionId) => (
              <textarea
                id={id}
                aria-describedby={`${descriptionId} ${error ? errorId : ""}`.trim()}
                aria-required="true"
                aria-invalid={!!error}
                rows={5}
                placeholder="e.g. A task management tool for remote teams that integrates with Slack and GitHub..."
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                className="block w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-accent-purple"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            )}
          </FormField>

          {error && (
            <p className="text-xs text-accent-red" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading || !ideaText.trim()}>
              {loading ? "Creating..." : "Start interview"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
