export {
  QUESTIONS,
  PHASE_LABELS,
  PHASE_ORDER,
  getQuestionsByPhase,
  getRequiredQuestions,
  countQuestions,
  findQuestionByRef,
  resolveDependencyRef,
} from "./questions.js";

export type {
  InterviewStatus,
  InterviewMode,
  QuestionDefinition,
  QuestionPhaseType,
  QuestionType,
  QuestionCategory,
  DependencyRule,
  ValidationRule,
  CaptureAs,
} from "./types.js";

export { canTransition, FLOW_TRANSITIONS } from "./types.js";

export { createInitialState, transitionState, isInterviewActive, isInterviewComplete } from "./flow.js";
