"use client";

import { useState, useEffect } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThinkingLoader } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listCredentials, createCredential, deleteCredential, validateCredential } from "@/lib/api";
import type { ProviderCredential } from "@/lib/api";

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { value: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
  { value: "opencode-go", label: "OpenCode Go", placeholder: "oc-go-..." },
];

const MODEL_OPTIONS = [
  { provider: "openai", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1"] },
  { provider: "anthropic", models: ["claude-3-5-haiku-latest", "claude-sonnet-4-20250514"] },
  { provider: "openrouter", models: ["openai/gpt-4o-mini", "openai/gpt-4o", "anthropic/claude-sonnet-4"] },
  {
    provider: "opencode-go",
    models: [
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "kimi-k2.6",
      "kimi-k2.5",
      "glm-5.1",
      "glm-5",
      "mimo-v2.5-pro",
      "mimo-v2.5",
      "qwen3.6-plus",
      "qwen3.5-plus",
    ],
  },
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  valid: { label: "Connected", className: "border-accent-green-dim bg-accent-green-dim/30 text-accent-green" },
  unverified: { label: "Unverified", className: "border-accent-amber-dim bg-accent-amber-dim/30 text-accent-amber" },
  invalid: { label: "Invalid", className: "border-accent-red-dim bg-accent-red-dim/30 text-accent-red" },
  expired: { label: "Expired", className: "border-border-subtle bg-bg-surface text-text-muted" },
  rate_limited: { label: "Rate Limited", className: "border-accent-amber-dim bg-accent-amber-dim/30 text-accent-amber" },
  failed: { label: "Failed", className: "border-accent-red-dim bg-accent-red-dim/40 text-accent-red" },
};

const selectClasses = "mt-1 block w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple";

export default function SettingsPage() {
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newProvider, setNewProvider] = useState("openai");
  const [newKey, setNewKey] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDefaultModel, setNewDefaultModel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listCredentials();
      setCredentials(result.data);
    } catch {
      setError("Failed to load credentials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCredential({
        provider: newProvider,
        apiKey: newKey.trim(),
        displayName: newDisplayName.trim() || undefined,
        defaultModel: newDefaultModel || undefined,
      });
      setNewKey("");
      setNewDisplayName("");
      setNewDefaultModel("");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save credential");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCredential(id);
      await load();
    } catch {
      setError("Failed to delete credential");
    }
  };

  const handleValidate = async (id: string) => {
    try {
      await validateCredential(id);
      await load();
    } catch {
      setError("Failed to validate credential");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Manage your AI provider connections. Keys are encrypted and never exposed.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} disabled={showAdd}>
          Add provider
        </Button>
      </div>

      {error && (
        <div className="rounded border border-accent-red-dim bg-accent-red-dim/30 p-3 text-xs text-accent-red">{error}</div>
      )}

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>New provider connection</CardTitle>
            <CardDescription>Your API key is encrypted before storage and never displayed.</CardDescription>
          </CardHeader>
          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="block text-xs font-medium text-text-primary">Provider</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className={selectClasses}
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary">API Key</label>
              <Input
                type="password"
                placeholder={
                  PROVIDER_OPTIONS.find((o) => o.value === newProvider)?.placeholder ?? "Enter API key"
                }
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary">Default model (optional)</label>
              <select
                value={newDefaultModel}
                onChange={(e) => setNewDefaultModel(e.target.value)}
                className={selectClasses}
              >
                <option value="">Auto-select</option>
                {MODEL_OPTIONS.find((m) => m.provider === newProvider)?.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleAdd} disabled={saving || !newKey.trim()}>
                {saving ? "Saving..." : "Connect"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAdd(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <ThinkingLoader />
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded border-2 border-dashed border-border-default bg-bg-surface p-12 text-center">
          <p className="text-sm font-medium text-text-primary">No providers connected</p>
          <p className="mt-1 text-xs text-text-secondary">Add an API key to enable AI-powered features.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => {
            const statusCfg = STATUS_CONFIG[cred.status] ?? STATUS_CONFIG.unverified;
            return (
              <div key={cred.id} className="rounded border border-border-default bg-bg-elevated p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary text-sm">{cred.displayName}</span>
                      <span
                        className={cn("rounded px-2 py-0.5 text-xs font-medium", statusCfg.className)}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {cred.provider}
                      {cred.defaultModel && ` · ${cred.defaultModel}`}
                      {cred.lastVerifiedAt &&
                        ` · Verified ${new Date(cred.lastVerifiedAt).toLocaleDateString()}`}
                    </p>
                    {cred.errorMessage && <p className="text-xs text-accent-red">{cred.errorMessage}</p>}
                  </div>
                  <div className="flex gap-2">
                    {cred.status !== "valid" && (
                      <button
                        onClick={() => handleValidate(cred.id)}
                        className="text-xs text-accent-purple hover:underline"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(cred.id)}
                      className="text-xs text-accent-red hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cost estimate</CardTitle>
          <CardDescription>Estimated cost per generation for common task types.</CardDescription>
        </CardHeader>
        <div className="space-y-3 px-6 pb-6">
          <CostRow label="Clarification question" tier="cheap" tokens={400} cost={0.0001} />
          <CostRow label="Summary" tier="cheap" tokens={600} cost={0.0002} />
          <CostRow label="Roadmap generation" tier="balanced" tokens={2000} cost={0.005} />
          <CostRow label="Prompt generation" tier="balanced" tokens={1500} cost={0.0038} />
          <CostRow label="Architecture reasoning" tier="strong" tokens={4000} cost={0.02} />
        </div>
      </Card>
    </div>
  );
}

function CostRow({
  label,
  tier,
  tokens,
  cost,
}: {
  label: string;
  tier: string;
  tokens: number;
  cost: number;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-border-default px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-text-primary">{label}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium",
            tier === "cheap" && "bg-accent-green-dim text-accent-green",
            tier === "balanced" && "bg-accent-purple-dim text-accent-purple",
            tier === "strong" && "bg-accent-amber-dim text-accent-amber",
          )}
        >
          {tier}
        </span>
      </div>
      <div className="text-right">
        <span className="font-medium text-text-primary">${cost.toFixed(4)}</span>
        <span className="ml-2 text-text-muted">~{tokens} tokens</span>
      </div>
    </div>
  );
}
