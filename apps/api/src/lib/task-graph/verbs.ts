export type TaskType = "code" | "config" | "test" | "docs" | "review" | "deploy" | "pending_input" | "other";

export function taskTypeVerb(taskType: TaskType): string {
  switch (taskType) {
    case "code": return "Implement";
    case "config": return "Configure";
    case "test": return "Write tests for";
    case "docs": return "Document";
    case "review": return "Review";
    case "deploy": return "Deploy";
    case "pending_input": return "Provide input for";
    case "other": return "Implement";
  }
}
