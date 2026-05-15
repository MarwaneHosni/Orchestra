import type { PromptArtifact, PromptValidationResult } from "./types.js";
import { REQUIRED_SECTIONS, MIN_PROMPT_LENGTH, MAX_PROMPT_LENGTH } from "./types.js";

export function validatePrompt(artifact: PromptArtifact): PromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check all required sections exist
  for (const section of REQUIRED_SECTIONS) {
    const value = (artifact.sections as unknown as Record<string, unknown>)[section];
    if (value === undefined || value === null) {
      errors.push(`Missing required section: ${section}`);
    } else if (typeof value === "string" && value.trim().length === 0) {
      errors.push(`Section "${section}" is empty`);
    } else if (Array.isArray(value) && value.length === 0) {
      errors.push(`Section "${section}" has no entries`);
    }
  }

  // Check prompt length
  const length = artifact.promptText.length;
  if (length < MIN_PROMPT_LENGTH) {
    errors.push(`Prompt is too short (${length} chars). Minimum is ${MIN_PROMPT_LENGTH}.`);
  } else if (length > MAX_PROMPT_LENGTH) {
    warnings.push(`Prompt is very long (${length} chars). Consider splitting.`);
  }

  // Check agent tips have content
  const tips = artifact.sections.agentTips;
  if (tips) {
    const totalTips =
      tips.security.length + tips.edgeCases.length + tips.dependencyWarnings.length + tips.commonBugs.length;
    if (totalTips === 0) {
      errors.push("Agent tips section is empty — must include at least one tip");
    }
  }

  // Check key sections are substantial
  if (artifact.sections.objective && artifact.sections.objective.length < 10) {
    errors.push("Objective is too short — must describe what to build");
  }
  if (artifact.sections.expectedOutput && artifact.sections.expectedOutput.length < 20) {
    errors.push("Expected output is too short — must describe what to produce");
  }

  return { valid: errors.length === 0, errors, warnings };
}
