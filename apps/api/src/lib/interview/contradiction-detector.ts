import type { AnswerRecord } from "../orchestration/types.js";

export interface Contradiction {
  type: "direct_conflict" | "implied_conflict" | "gate_violation";
  severity: "high" | "medium" | "low";
  questionRefA: string;
  questionRefB: string;
  valueA: string;
  valueB: string;
  explanation: string;
  resolution?: string;
}

function get(questionRef: string, answers: AnswerRecord[]): string | undefined {
  return answers.find((a) => a.questionId === questionRef)?.value;
}

function has(questionRef: string, option: string, answers: AnswerRecord[]): boolean {
  const val = get(questionRef, answers);
  if (!val) return false;
  return val.split(",").map((s) => s.trim()).includes(option);
}

// ── Detection rules ──────────────────────────────────────────────

function detectRealTimeConflict(answers: AnswerRecord[]): Contradiction | null {
  const archRealTime = get("architecture.3", answers);
  const backEndRealTime = has("backend.1", "Real-time / WebSocket", answers);
  if (archRealTime === "false" && backEndRealTime) {
    return {
      type: "direct_conflict",
      severity: "high",
      questionRefA: "architecture.3",
      questionRefB: "backend.1",
      valueA: "false",
      valueB: "Real-time / WebSocket (selected)",
      explanation: "You said the system doesn't need real-time features, but selected WebSocket support in backend capabilities.",
      resolution: "Update architecture.3 to 'true' or deselect Real-time/WebSocket in backend capabilities.",
    };
  }
  return null;
}

function detectScaleConflict(answers: AnswerRecord[]): Contradiction | null {
  const users = get("ideation.4", answers) ?? "";
  const requests = get("backend.3", answers) ?? "";
  if (!users || !requests) return null;

  const userScale = parseScale(users);
  const reqScale = parseScale(requests);
  if (userScale > 0 && reqScale > 0) {
    const ratio = reqScale / userScale;
    if (ratio > 100) {
      return {
        type: "implied_conflict",
        severity: "medium",
        questionRefA: "ideation.4",
        questionRefB: "backend.3",
        valueA: users,
        valueB: requests,
        explanation: `Your expected user count (${users}) seems inconsistent with expected API volume (${requests}).`,
        resolution: "If this is a consumer-facing app, API volume typically exceeds user count. If it's internal, the ratio may be different.",
      };
    }
  }
  return null;
}

function parseScale(value: string): number {
  const match = value.match(/([\d,]+)\s*[-–]\s*([\d,]+)/);
  if (match) {
    const low = Number(match[1]!.replace(/,/g, ""));
    return low;
  }
  const single = value.match(/^< ([\d,]+)/);
  if (single) return Number(single[1]!.replace(/,/g, ""));
  const plus = value.match(/([\d,]+)\+/);
  if (plus) return Number(plus[1]!.replace(/,/g, ""));
  return 0;
}

function detectAuthConflict(answers: AnswerRecord[]): Contradiction | null {
  const needsAuth = get("requirements.2", answers);
  const selectedMethods = get("requirements.3", answers);
  if (needsAuth === "true" && (!selectedMethods || selectedMethods.trim() === "")) {
    return {
      type: "gate_violation",
      severity: "high",
      questionRefA: "requirements.2",
      questionRefB: "requirements.3",
      valueA: "true",
      valueB: "(not answered)",
      explanation: "You indicated the app needs authentication, but didn't specify which methods.",
      resolution: "Please answer the authentication methods question or set requirements.2 to false.",
    };
  }
  return null;
}

function detectAIConflict(answers: AnswerRecord[]): Contradiction | null {
  const usesAI = get("ai-systems.1", answers);
  const needsAI = usesAI === "true";
  const selectedCapabilities = get("ai-systems.2", answers);
  if (needsAI && (!selectedCapabilities || selectedCapabilities.trim() === "")) {
    return {
      type: "gate_violation",
      severity: "high",
      questionRefA: "ai-systems.1",
      questionRefB: "ai-systems.2",
      valueA: "true",
      valueB: "(not answered)",
      explanation: "You indicated the app uses AI, but didn't specify which AI capabilities.",
      resolution: "Please answer the AI capabilities question or set ai-systems.1 to false.",
    };
  }
  return null;
}

function detectPlatformConflict(answers: AnswerRecord[]): Contradiction | null {
  const platform = get("ideation.2", answers) ?? "";
  const frontendNeeds = get("frontend.1", answers) ?? "";
  if (platform.includes("API/service only") && frontendNeeds.length > 0) {
    return {
      type: "implied_conflict",
      severity: "medium",
      questionRefA: "ideation.2",
      questionRefB: "frontend.1",
      valueA: "API/service only",
      valueB: frontendNeeds,
      explanation: "You selected API/service only as the platform, but specified frontend capabilities.",
      resolution: "If this is an API-only service, frontend capabilities may not be needed.",
    };
  }
  return null;
}

// ── Orchestration ────────────────────────────────────────────────

const DETECTORS: Array<(answers: AnswerRecord[]) => Contradiction | null> = [
  detectRealTimeConflict,
  detectScaleConflict,
  detectAuthConflict,
  detectAIConflict,
  detectPlatformConflict,
];

export function detectAllContradictions(answers: AnswerRecord[]): Contradiction[] {
  const results: Contradiction[] = [];
  for (const detector of DETECTORS) {
    try {
      const result = detector(answers);
      if (result) results.push(result);
    } catch {
      // Silently skip failed detector
    }
  }
  return results;
}

export function hasHighSeverityContradiction(answers: AnswerRecord[]): boolean {
  return detectAllContradictions(answers).some((c) => c.severity === "high");
}

export function getContradictionSummary(answers: AnswerRecord[]): string[] {
  return detectAllContradictions(answers).map((c) => c.explanation);
}
