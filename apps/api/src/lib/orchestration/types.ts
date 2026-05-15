export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaRecord {
  id: string;
  projectId: string;
  rawDescription: string;
  refinedDescription: string | null;
  status: string;
  provenance: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  projectId: string;
  status: "draft" | "in_progress" | "waiting_for_answers" | "ready_for_generation" | "completed";
  currentPhaseIndex: number;
  currentQuestionIndex: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerRecord {
  id: string;
  questionId: string;
  projectId: string;
  sessionId: string;
  value: string;
  confidence: string;
  provenance: string;
  createdAt: string;
}

export interface CreateProjectInput {
  ideaText: string;
  projectName?: string;
}
