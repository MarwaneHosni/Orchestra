import type { FastifyInstance } from "fastify";
import { onProgress, emitProgress } from "../lib/events/progress-emitter.js";
import { STAGE_ORDER, PROGRESS_SCHEMA_VERSION, createEvent } from "../lib/events/schema.js";
import { getWorkflowState, getRecentEvents, cancelWorkflow } from "../lib/events/workflow-registry.js";

export async function registerProgressRoutes(app: FastifyInstance) {
  app.get("/api/v1/progress/:workflowId", (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    const origin = request.headers.origin ?? "*";

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    });

    // Send metadata
    const connectedPayload = JSON.stringify({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      workflowId,
      stages: STAGE_ORDER,
    });
    reply.raw.write(`event: connected\ndata: ${connectedPayload}\n\n`);

    // Replay recent events for late-connecting / reconnecting clients
    const recent = getRecentEvents(workflowId);
    for (const ev of recent.slice(-10)) {
      try {
        reply.raw.write(`event: ${ev.eventType}\ndata: ${JSON.stringify(ev)}\n\n`);
      } catch {
        break;
      }
    }

    // If no events exist yet (workflow just registered), send synthetic
    // initial events so the frontend has something to show immediately
    if (recent.length === 0) {
      const now = new Date().toISOString();
      const base = {
        schemaVersion: PROGRESS_SCHEMA_VERSION,
        workflowId,
        sequence: 0,
        createdAt: now,
      };
      reply.raw.write(`event: stage_started\ndata: ${JSON.stringify({
        ...base, eventId: crypto.randomUUID(), eventType: "stage_started",
        stage: "synthesis", payload: { stageLabel: "Analyzing your answers", attempt: 1 },
      })}\n\n`);
      reply.raw.write(`event: progress\ndata: ${JSON.stringify({
        ...base, eventId: crypto.randomUUID(), eventType: "progress",
        stage: "synthesis", payload: { detail: "Starting generation...", elapsed: 0 },
      })}\n\n`);
    }

    // If the workflow is already in a terminal state, close
    const state = getWorkflowState(workflowId);
    if (!state || !state.abortController) {
      // Workflow doesn't exist or already ended — no more events will come
      reply.raw.end();
      return;
    }

    const cleanup = onProgress(workflowId, (event) => {
      try {
        const data = JSON.stringify(event);
        reply.raw.write(`event: ${event.eventType}\ndata: ${data}\n\n`);

        if (event.eventType === "completed" || event.eventType === "cancelled") {
          reply.raw.end();
        }
      } catch {
        // client disconnected
      }
    });

    request.raw.on("close", () => {
      cleanup();
    });

    // Heartbeat to detect stalled connections
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    request.raw.on("close", () => {
      cleanup();
      clearInterval(heartbeat);
    });
  });

  // ── Cancellation endpoint ─────────────────────────────────────────
  app.post("/api/v1/progress/:workflowId/cancel", (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };

    const state = getWorkflowState(workflowId);
    if (!state) {
      return reply.status(404).send({ error: "Workflow not found or already completed" });
    }

    const cancelled = cancelWorkflow(workflowId);
    if (cancelled) {
      emitProgress(createEvent(workflowId, "cancelled", state.stage as any, {
        reason: "Cancelled by user",
        stageLabel: state.stage,
      }));
    }

    return { cancelled: true, workflowId };
  });
}
