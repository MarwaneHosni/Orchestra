import { EXECUTION_PROMPT_SECTIONS, PROMPT_SCHEMA_VERSION } from "./schema.js";
import type { ParsedSection, StructuralValidationResult, StructuralValidationError } from "./schema.js";
import { parseMarkdownSections, matchSectionId } from "./markdown-parser.js";

const KNOWN_SECTIONS: { heading: string; id: string }[] = EXECUTION_PROMPT_SECTIONS.map((s) => ({
  heading: s.heading,
  id: s.id,
}));

export { PROMPT_SCHEMA_VERSION };

export function validateExecutionPrompt(markdown: string): StructuralValidationResult {
  const errors: StructuralValidationError[] = [];
  const sections = parseMarkdownSections(markdown);
  const sectionDefs = EXECUTION_PROMPT_SECTIONS;

  // Map parsed sections to definitions by heading match
  const matchedIds = new Map<string, ParsedSection>();

  for (const parsed of sections) {
    const id = matchSectionId(parsed.heading, KNOWN_SECTIONS);
    if (matchedIds.has(id)) {
      errors.push({
        section: id,
        code: "duplicate",
        message: `Duplicate section "${parsed.heading}" — each section must appear exactly once`,
      });
    }
    matchedIds.set(id, { ...parsed, id });
  }

  // Check order: iterate through definitions and ensure sections appear in order
  let lastDefIndex = -1;
  for (const parsed of sections) {
    const id = matchSectionId(parsed.heading, KNOWN_SECTIONS);
    const defIndex = sectionDefs.findIndex((d) => d.id === id);
    if (defIndex === -1) continue; // unknown section, skip
    if (defIndex < lastDefIndex) {
      errors.push({
        section: id,
        code: "out_of_order",
        message: `Section "${parsed.heading}" appears after a later required section`,
      });
    } else {
      lastDefIndex = defIndex;
    }
  }

  // Check each required section
  for (const def of sectionDefs) {
    const parsed = matchedIds.get(def.id);

    if (!parsed) {
      errors.push({
        section: def.id,
        code: "missing",
        message: `Missing required section "## ${def.heading}" — ${def.description}`,
      });
      continue;
    }

    if (!parsed.content || parsed.content.length === 0) {
      errors.push({
        section: def.id,
        code: "empty",
        message: `Section "## ${def.heading}" is empty — it must contain content`,
      });
      continue;
    }

    if (parsed.content.length < def.minContentLength) {
      errors.push({
        section: def.id,
        code: "too_short",
        message: `Section "## ${def.heading}" is too short (${parsed.content.length} chars, minimum ${def.minContentLength}) — ${def.description}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    sections,
    errors,
  };
}

export function extractSectionContent(markdown: string, sectionHeading: string): string | null {
  const sections = parseMarkdownSections(markdown);
  for (const s of sections) {
    if (s.heading.toLowerCase() === sectionHeading.toLowerCase()) {
      return s.content;
    }
  }
  return null;
}
