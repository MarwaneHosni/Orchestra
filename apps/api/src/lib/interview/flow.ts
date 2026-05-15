import type { InterviewStatus } from "./types.js";
import { canTransition, FLOW_TRANSITIONS } from "./types.js";

export interface InterviewState {
  sessionId: string;
  projectId: string;
  status: InterviewStatus;
  currentPhaseIndex: number;
  currentQuestionIndex: number;
  answeredQuestionIds: string[];
  startedAt: Date | null;
  completedAt: Date | null;
}

export function createInitialState(sessionId: string, projectId: string): InterviewState {
  return {
    sessionId,
    projectId,
    status: "draft",
    currentPhaseIndex: 0,
    currentQuestionIndex: 0,
    answeredQuestionIds: [],
    startedAt: null,
    completedAt: null,
  };
}

export function transitionState(state: InterviewState, to: InterviewStatus): InterviewState {
  if (!canTransition(state.status, to)) {
    throw new Error(
      `Cannot transition from ${state.status} to ${to}. ` + `Allowed: ${listTransitionsFrom(state.status)}`,
    );
  }

  const now = new Date();
  return {
    ...state,
    status: to,
    startedAt: to === "in_progress" && !state.startedAt ? now : state.startedAt,
    completedAt: to === "completed" ? now : state.completedAt,
  };
}

function listTransitionsFrom(status: InterviewStatus): string {
  return FLOW_TRANSITIONS.filter((t) => t.from.includes(status))
    .map((t) => t.to)
    .join(", ");
}

export function isInterviewComplete(state: InterviewState): boolean {
  return state.status === "completed" || state.status === "ready_for_generation";
}

export function isInterviewActive(state: InterviewState): boolean {
  return state.status === "in_progress" || state.status === "waiting_for_answers";
}
