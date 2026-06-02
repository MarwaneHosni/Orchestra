export const PROMPT_SCHEMA_VERSION = 1;

export interface PromptSectionDefinition {
  id: string;
  heading: string;
  headingLevel: number;
  required: boolean;
  minContentLength: number;
  description: string;
}

export const EXECUTION_PROMPT_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "objective",
    heading: "Objective",
    headingLevel: 2,
    required: true,
    minContentLength: 30,
    description: "What needs to be built",
  },
  {
    id: "context",
    heading: "Context",
    headingLevel: 2,
    required: true,
    minContentLength: 80,
    description: "Project description, phase goal, key background",
  },
  {
    id: "constraints",
    heading: "Constraints",
    headingLevel: 2,
    required: true,
    minContentLength: 1,
    description: "ALL constraints, assumptions, and risks from the interview",
  },
  {
    id: "expectedOutput",
    heading: "Expected Output",
    headingLevel: 2,
    required: true,
    minContentLength: 40,
    description: "What the execution should produce",
  },
  {
    id: "validationCriteria",
    heading: "Validation Criteria",
    headingLevel: 2,
    required: true,
    minContentLength: 1,
    description: "Specific, testable items as bullet list",
  },
  {
    id: "architecturalAlignment",
    heading: "Architectural Alignment",
    headingLevel: 2,
    required: true,
    minContentLength: 1,
    description: "How this fits the project architecture",
  },
  {
    id: "agentTips",
    heading: "Agent Tips",
    headingLevel: 2,
    required: true,
    minContentLength: 1,
    description: "Security, edge cases, dependency warnings, common bugs",
  },
] as const;

export interface ParsedSection {
  id: string;
  heading: string;
  headingLevel: number;
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface StructuralValidationError {
  section: string;
  code: "missing" | "empty" | "duplicate" | "out_of_order" | "too_short" | "no_content_before_first_section";
  message: string;
}

export interface StructuralValidationResult {
  valid: boolean;
  sections: ParsedSection[];
  errors: StructuralValidationError[];
}
