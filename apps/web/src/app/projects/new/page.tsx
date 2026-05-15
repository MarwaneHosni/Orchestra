"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">New project</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Describe your software idea. Orchestra will guide you through the rest.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>Provide a name and a brief description of your idea.</CardDescription>
        </CardHeader>
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <FormField label="Project name" required description="A short, descriptive name for your project.">
            {(id, _errorId, descriptionId) => (
              <Input id={id} placeholder="e.g. My SaaS Platform" aria-describedby={descriptionId} />
            )}
          </FormField>

          <FormField label="Description" description="What problem does your software solve?">
            {(id, _errorId, descriptionId) => (
              <textarea
                id={id}
                aria-describedby={descriptionId}
                rows={4}
                placeholder="e.g. A task management tool for remote teams that integrates with Slack and GitHub..."
                className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-orchestra-500 focus:border-orchestra-500"
              />
            )}
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="submit">Start interview</Button>
            <Button type="button" variant="secondary">
              Save draft
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
