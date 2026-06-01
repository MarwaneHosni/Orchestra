import type { PromptArtifact, PromptValidationResult } from "./types.js";
import { MAX_PROMPT_LENGTH } from "./types.js";
import { validateExecutionPrompt } from "./structural-validator.js";

export function validatePrompt(artifact: PromptArtifact): PromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Delegate 7-section structural checks to the canonical validator (uses
  // EXECUTION_PROMPT_SECTIONS minContentLength from schema.ts — single source of truth).
  const structural = validateExecutionPrompt(artifact.promptText);
  for (const se of structural.errors) {
    errors.push(se.message);
  }

  // Check agent tips have content (unique to validatePrompt — structural validator
  // only checks agent tips section length, not specific tip categories).
  const tips = artifact.sections.agentTips;
  if (tips) {
    const totalTips =
      tips.security.length + tips.edgeCases.length + tips.dependencyWarnings.length + tips.commonBugs.length;
    if (totalTips === 0) {
      errors.push("Agent tips section is empty — must include at least one tip");
    }
  }

  // Check total prompt length (warning only — structural validator enforces
  // per-section minimums, this catches abnormally long prompts).
  const length = artifact.promptText.length;
  if (length > MAX_PROMPT_LENGTH) {
    warnings.push(`Prompt is very long (${length} chars). Consider splitting.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
