"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure your AI providers and application preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <CardDescription>
            Orchestra uses your own API keys. No keys are stored on our servers.
          </CardDescription>
        </CardHeader>
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <FormField
            label="OpenAI API Key"
            description="Used for GPT-4 and GPT-3.5 models."
          >
            {(id, _errorId, descriptionId) => (
              <Input id={id} type="password" placeholder="sk-..." aria-describedby={descriptionId} />
            )}
          </FormField>

          <FormField
            label="Anthropic API Key"
            description="Used for Claude models."
          >
            {(id, _errorId, descriptionId) => (
              <Input id={id} type="password" placeholder="sk-ant-..." aria-describedby={descriptionId} />
            )}
          </FormField>

          <div className="pt-2">
            <Button type="submit" variant="primary">Save settings</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            General application settings.
          </CardDescription>
        </CardHeader>
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <FormField
            label="Default model"
            description="Preferred AI model for plan generation."
          >
            {(id, _errorId, descriptionId) => (
              <select
                id={id}
                aria-describedby={descriptionId}
                className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-orchestra-500"
              >
                <option value="">Select a model</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            )}
          </FormField>

          <div className="pt-2">
            <Button type="submit" variant="primary">Save preferences</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
