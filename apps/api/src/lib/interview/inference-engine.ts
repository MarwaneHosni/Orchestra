import type { AnswerRecord } from "../orchestration/types.js";

export interface InferredValue {
  questionRef: string;
  inferredValue: string;
  confidence: "high" | "medium" | "low";
  basedOn: string[];
  explanation: string;
}

export interface InferenceResult {
  inferences: InferredValue[];
  derivableConfirmed: boolean;
}

function getAnswer(questionRef: string, answers: AnswerRecord[]): string | undefined {
  return answers.find((a) => a.questionId === questionRef)?.value;
}

function hasOption(questionRef: string, option: string, answers: AnswerRecord[]): boolean {
  const val = getAnswer(questionRef, answers);
  if (!val) return false;
  return val.split(",").map((s) => s.trim()).includes(option);
}

// ── Inference rules for each derivable question ──────────────────

export function inferIdeation3(answers: AnswerRecord[]): InferredValue {
  const features = getAnswer("ideation.1", answers) ?? "";
  const isNew = !/rebuild|migration|existing|addition/i.test(features);
  return {
    questionRef: "ideation.3",
    inferredValue: isNew ? "New product" : "Addition to existing product",
    confidence: features.length > 50 ? "high" : "medium",
    basedOn: ["ideation.1"],
    explanation: isNew
      ? "Based on your problem description, this appears to be a new project."
      : "Your description suggests this builds on existing work.",
  };
}

export function inferDatabase2(answers: AnswerRecord[]): InferredValue {
  const scale = getAnswer("ideation.4", answers) ?? "";
  const dataTypes = getAnswer("database.1", answers) ?? "";

  let volume: string;
  let confidence: "high" | "medium" | "low";

  if (scale.includes("100,000+")) {
    volume = "100 GB – 1 TB";
    confidence = "medium";
  } else if (scale.includes("10,000")) {
    volume = "10 – 100 GB";
    confidence = "medium";
  } else if (scale.includes("1,000")) {
    volume = "1 – 10 GB";
    confidence = "high";
  } else if (scale.includes("100")) {
    volume = "< 1 GB";
    confidence = "high";
  } else {
    volume = "1 – 10 GB";
    confidence = "low";
  }

  if (dataTypes.includes("File") || dataTypes.includes("Time-series")) {
    volume = scaleUp(volume);
    confidence = confidence === "low" ? "low" : "medium";
  }

  return {
    questionRef: "database.2",
    inferredValue: volume,
    confidence,
    basedOn: ["ideation.4", "database.1"],
    explanation: `Based on your expected scale of ${scale || "initial launch"}, we estimate data volume around ${volume}.`,
  };
}

function scaleUp(vol: string): string {
  const tiers = ["< 1 GB", "1 – 10 GB", "10 – 100 GB", "100 GB – 1 TB", "1 TB+"];
  const idx = tiers.indexOf(vol);
  if (idx >= 0 && idx < tiers.length - 1) return tiers[idx + 1]!;
  return vol;
}

export function inferBackend2(answers: AnswerRecord[]): InferredValue {
  const hasJobProcessing = hasOption("backend.1", "Background job processing", answers);
  return {
    questionRef: "backend.2",
    inferredValue: hasJobProcessing ? "true" : "false",
    confidence: hasJobProcessing ? "high" : "medium",
    basedOn: ["backend.1"],
    explanation: hasJobProcessing
      ? "You selected Background job processing as a backend capability."
      : "No background job processing was selected in backend capabilities.",
  };
}

export function inferBackend3(answers: AnswerRecord[]): InferredValue {
  const scale = getAnswer("ideation.4", answers) ?? "";
  let volume: string;
  let confidence: "high" | "medium" | "low";
  if (scale.includes("100,000+")) {
    volume = "100K – 1M requests/day";
    confidence = "medium";
  } else if (scale.includes("10,000")) {
    volume = "10K – 100K requests/day";
    confidence = "medium";
  } else if (scale.includes("1,000")) {
    volume = "1K – 10K requests/day";
    confidence = "high";
  } else if (scale.includes("100")) {
    volume = "< 1K requests/day";
    confidence = "high";
  } else {
    volume = "1K – 10K requests/day";
    confidence = "low";
  }
  return {
    questionRef: "backend.3",
    inferredValue: volume,
    confidence,
    basedOn: ["ideation.4"],
    explanation: `Based on your expected user count of ${scale || "unknown"}, we estimate API volume around ${volume}.`,
  };
}

export function inferFrontend2(answers: AnswerRecord[]): InferredValue {
  const platform = getAnswer("ideation.2", answers) ?? "";
  const needsSSR = platform.includes("Web") || platform.includes("Cross-platform");
  return {
    questionRef: "frontend.2",
    inferredValue: needsSSR ? "true" : "false",
    confidence: platform ? "high" : "low",
    basedOn: ["ideation.2"],
    explanation: needsSSR
      ? `Since your app is ${platform}, server-side rendering is recommended for SEO.`
      : `Since your app is ${platform}, SSR is likely not needed.`,
  };
}

export function inferTesting1(answers: AnswerRecord[]): InferredValue {
  const features = getAnswer("requirements.1", answers) ?? "";
  const isComplex = features.length > 150 || /\bsecurity|payment|financial|healthcare\b/i.test(features);
  return {
    questionRef: "testing.1",
    inferredValue: isComplex ? "Core features (~60%)" : "Critical paths only (~30%)",
    confidence: "medium",
    basedOn: ["requirements.1"],
    explanation: isComplex
      ? "Based on the complexity of your requirements, we recommend core feature coverage."
      : "For simpler projects, critical path coverage is usually sufficient.",
  };
}

export function inferTesting2(answers: AnswerRecord[]): InferredValue {
  const platform = getAnswer("ideation.2", answers) ?? "";
  const features = getAnswer("requirements.1", answers) ?? "";
  const types: string[] = ["Unit tests", "Integration tests"];
  if (features.length > 100 || platform.includes("Web")) types.push("End-to-end (E2E) tests");
  if (/\bapi|integration|service\b/i.test(features)) types.push("API contract tests");
  return {
    questionRef: "testing.2",
    inferredValue: types.join(","),
    confidence: "medium",
    basedOn: ["ideation.2", "requirements.1"],
    explanation: `Based on your project type, we recommend a standard test suite: ${types.join(", ")}.`,
  };
}

export function inferDeployment1(answers: AnswerRecord[]): InferredValue {
  const platform = getAnswer("ideation.2", answers) ?? "";
  const techStack = getAnswer("architecture.1", answers) ?? "";
  let host: string;
  let confidence: "high" | "medium" | "low";
  if (/\baws\b/i.test(techStack)) {
    host = "AWS"; confidence = "high";
  } else if (/\bgcp|google\b/i.test(techStack)) {
    host = "Google Cloud"; confidence = "high";
  } else if (/\bazure\b/i.test(techStack)) {
    host = "Azure"; confidence = "high";
  } else if (platform.includes("Web") || platform.includes("Cross-platform")) {
    host = "Vercel / Netlify"; confidence = "medium";
  } else if (platform.includes("Mobile")) {
    host = "AWS"; confidence = "medium";
  } else {
    host = "Not sure yet"; confidence = "low";
  }
  return {
    questionRef: "deployment.1",
    inferredValue: host,
    confidence,
    basedOn: ["ideation.2", "architecture.1"],
    explanation: confidence === "high"
      ? `You mentioned ${techStack} in your tech stack preferences.`
      : `Based on your platform (${platform}), we suggest ${host} as a starting point.`,
  };
}

export function inferDeployment2(_answers: AnswerRecord[]): InferredValue {
  return {
    questionRef: "deployment.2",
    inferredValue: "CI/CD pipeline,Staging environment",
    confidence: "medium",
    basedOn: [],
    explanation: "Most projects benefit from CI/CD and a staging environment as standard practice.",
  };
}

export function inferMonitoring1(_answers: AnswerRecord[]): InferredValue {
  return {
    questionRef: "monitoring.1",
    inferredValue: "Error tracking (e.g. Sentry),Log aggregation,Application monitoring (APM)",
    confidence: "medium",
    basedOn: [],
    explanation: "We recommend a standard observability stack: error tracking, logging, and APM.",
  };
}

export function inferMonitoring2(answers: AnswerRecord[]): InferredValue {
  const scale = getAnswer("ideation.4", answers) ?? "";
  const sla = scale.includes("100,000+") || scale.includes("10,000")
    ? "99.9% (8h downtime/year)"
    : "99% (88h downtime/year)";
  return {
    questionRef: "monitoring.2",
    inferredValue: sla,
    confidence: scale ? "medium" : "low",
    basedOn: ["ideation.4"],
    explanation: `Based on your expected scale (${scale || "unknown"}), we recommend ${sla}.`,
  };
}

// ── Orchestration ────────────────────────────────────────────────

export const INFERENCE_RULES: Array<(answers: AnswerRecord[]) => InferredValue> = [
  inferIdeation3,
  inferDatabase2,
  inferBackend2,
  inferBackend3,
  inferFrontend2,
  inferTesting1,
  inferTesting2,
  inferDeployment1,
  inferDeployment2,
  inferMonitoring1,
  inferMonitoring2,
];

export function runAllInferences(answers: AnswerRecord[]): InferenceResult {
  const inferences: InferredValue[] = [];
  for (const rule of INFERENCE_RULES) {
    try {
      inferences.push(rule(answers));
    } catch {
      // Skip failed inference — will be handled as low-confidence
    }
  }
  return {
    inferences,
    derivableConfirmed: true,
  };
}

export function getInferenceByRef(ref: string, answers: AnswerRecord[]): InferredValue | undefined {
  const results = runAllInferences(answers);
  return results.inferences.find((i) => i.questionRef === ref);
}

export function shouldAskFollowUp(
  inferred: InferredValue,
): boolean {
  if (inferred.confidence === "high") return false;
  if (inferred.confidence === "low") return true;
  return false;
}
