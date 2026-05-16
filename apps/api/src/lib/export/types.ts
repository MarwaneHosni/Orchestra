export type ExportFormat = "markdown" | "json";

export interface ExportRecord {
  id: string;
  snapshotId: string;
  projectId: string;
  format: ExportFormat;
  type: "blueprint" | "task_graph" | "prompts" | "full_bundle";
  content: string;
  bundleVersion: string;
  snapshotVersion: number;
  planVersion: number | null;
  planId: string | null;
  sourceReason: string;
  lineageRef: string | null;
  createdAt: string;
}

import type { BlueprintContent } from "../diff/types.js";

export interface ExportOptions {
  format: ExportFormat;
  blueprintContent?: BlueprintContent | null;
}

export interface ExportStore {
  insert(r: ExportRecord): void;
  get(id: string): ExportRecord | undefined;
  getByProject(projectId: string): ExportRecord[];
  getBySnapshot(snapshotId: string): ExportRecord[];
}

export const EXPORT_BUNDLE_VERSION = "orchestra-export-v1";

export const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation",
  requirements: "Requirements",
  architecture: "Architecture",
  security: "Security",
  database: "Database",
  backend: "Backend",
  frontend: "Frontend",
  "core-features": "Core Features",
  "ai-systems": "AI Systems",
  testing: "Testing",
  deployment: "Deployment",
  monitoring: "Monitoring",
};

export const PHASE_ORDER = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
];
