import { EventEmitter } from "node:events";
import type { ProgressEventEnvelope } from "./schema.js";
import { registerWorkflow, recordEvent, unregisterWorkflow } from "./workflow-registry.js";

export type { ProgressEventEnvelope };

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function emitProgress(event: ProgressEventEnvelope): void {
  if (event.eventType === "started") {
    registerWorkflow(event.workflowId);
  }
  recordEvent(event);
  emitter.emit(event.workflowId, event);

  // Auto-cleanup on terminal events
  if (event.eventType === "completed" || event.eventType === "cancelled") {
    unregisterWorkflow(event.workflowId);
  }
}

export function onProgress(workflowId: string, listener: (event: ProgressEventEnvelope) => void): () => void {
  emitter.on(workflowId, listener);
  return () => { emitter.off(workflowId, listener); };
}

export function removeAllListeners(workflowId: string): void {
  emitter.removeAllListeners(workflowId);
}
