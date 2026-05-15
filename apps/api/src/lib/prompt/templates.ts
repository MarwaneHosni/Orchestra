export function formatPrompt(sections: {
  objective: string;
  context: string;
  constraints: string[];
  expectedOutput: string;
  validationCriteria: string[];
  architecturalAlignment: string;
  agentTips: {
    security: string[];
    edgeCases: string[];
    dependencyWarnings: string[];
    commonBugs: string[];
  };
}): string {
  const lines: string[] = [];

  lines.push("# Execution Prompt", "");
  lines.push("## Objective");
  lines.push(sections.objective, "");

  lines.push("## Context");
  lines.push(sections.context, "");

  lines.push("## Constraints");
  for (const c of sections.constraints) lines.push(`- ${c}`);
  lines.push("");

  lines.push("## Expected Output");
  lines.push(sections.expectedOutput, "");

  lines.push("## Validation Criteria");
  for (const v of sections.validationCriteria) lines.push(`- ${v}`);
  lines.push("");

  lines.push("## Architectural Alignment");
  lines.push(sections.architecturalAlignment, "");

  lines.push("## Agent Tips");

  if (sections.agentTips.security.length > 0) {
    lines.push("", "### Security");
    for (const s of sections.agentTips.security) lines.push(`- ${s}`);
  }

  if (sections.agentTips.edgeCases.length > 0) {
    lines.push("", "### Edge Cases");
    for (const e of sections.agentTips.edgeCases) lines.push(`- ${e}`);
  }

  if (sections.agentTips.dependencyWarnings.length > 0) {
    lines.push("", "### Dependency Warnings");
    for (const d of sections.agentTips.dependencyWarnings) lines.push(`- ${d}`);
  }

  if (sections.agentTips.commonBugs.length > 0) {
    lines.push("", "### Common Bugs");
    for (const b of sections.agentTips.commonBugs) lines.push(`- ${b}`);
  }

  return lines.join("\n");
}
