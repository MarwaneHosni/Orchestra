// Transition rules for workflow runs
const VALID_STEP_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["running"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

const VALID_WORKFLOW_STATUS_TRANSITIONS: Record<string, string[]> = {
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function validateStepTransition(stepName: string, from: string, to: string): void {
  const allowed = VALID_STEP_STATUS_TRANSITIONS[from];
  if (!allowed) {
    throw new Error(`Invalid step status '${from}' for ${stepName}`);
  }
  if (!allowed.includes(to)) {
    throw new Error(
      `Cannot transition ${stepName} from '${from}' to '${to}'. Allowed: ${allowed.join(", ") || "none"}`,
    );
  }
}

export function validateWorkflowTransition(from: string, to: string): void {
  const allowed = VALID_WORKFLOW_STATUS_TRANSITIONS[from];
  if (!allowed) {
    throw new Error(`Invalid workflow status '${from}'`);
  }
  if (!allowed.includes(to)) {
    throw new Error(
      `Cannot transition workflow from '${from}' to '${to}'. Allowed: ${allowed.join(", ") || "none"}`,
    );
  }
}

export function validateRequiredFields(
  entity: string,
  fields: Record<string, unknown>,
  required: string[],
): void {
  const missing = required.filter((f) => {
    const val = fields[f];
    return val === undefined || val === null || val === "";
  });
  if (missing.length > 0) {
    throw new Error(`${entity} missing required fields: ${missing.join(", ")}`);
  }
}

export function validateSessionTransition(from: string, to: string): string | null {
  const allowed: Record<string, string[]> = {
    draft: ["in_progress"],
    in_progress: ["waiting_for_answers", "ready_for_generation", "completed", "draft"],
    waiting_for_answers: ["in_progress"],
    ready_for_generation: ["in_progress", "completed"],
    completed: ["in_progress"],
  };
  const valid = allowed[from];
  if (!valid) return `Unknown session status '${from}'`;
  if (!valid.includes(to)) {
    return `Cannot transition session from '${from}' to '${to}'`;
  }
  return null;
}
