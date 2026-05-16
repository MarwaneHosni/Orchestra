export type QuestionType = "text" | "select" | "multi_select" | "boolean" | "scale";

export type QuestionPhaseType =
  | "ideation"
  | "requirements"
  | "architecture"
  | "security"
  | "database"
  | "backend"
  | "frontend"
  | "core-features"
  | "ai-systems"
  | "testing"
  | "deployment"
  | "monitoring";

export interface DependencyRule {
  questionRef: string;
  expectedValue: string | string[];
}

export interface ValidationRule {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface CaptureAs {
  type: "assumption" | "constraint" | "risk";
}

export interface QuestionDefinition {
  phaseType: QuestionPhaseType;
  order: number;
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  dependsOn?: DependencyRule;
  validation?: ValidationRule;
  captureAs?: CaptureAs;
  helpText?: string;
}

export type InterviewStatus =
  | "draft"
  | "in_progress"
  | "waiting_for_answers"
  | "ready_for_generation"
  | "completed";

export interface FlowTransition {
  from: InterviewStatus[];
  to: InterviewStatus;
  condition?: string;
}

export const FLOW_TRANSITIONS: FlowTransition[] = [
  { from: ["draft"], to: "in_progress", condition: "User starts the interview" },
  { from: ["in_progress"], to: "waiting_for_answers", condition: "Question presented to user" },
  { from: ["waiting_for_answers"], to: "in_progress", condition: "User submits an answer" },
  {
    from: ["in_progress", "waiting_for_answers"],
    to: "ready_for_generation",
    condition: "All required questions answered",
  },
  { from: ["ready_for_generation"], to: "completed", condition: "Plan generated from session" },
  {
    from: ["ready_for_generation"],
    to: "in_progress",
    condition: "User edits an answer after finishing all questions",
  },
  {
    from: ["draft", "in_progress", "waiting_for_answers"],
    to: "completed",
    condition: "User cancels / abandons",
  },
];

export function canTransition(from: InterviewStatus, to: InterviewStatus): boolean {
  return FLOW_TRANSITIONS.some((t) => t.to === to && t.from.includes(from));
}
