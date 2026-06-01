# Progress Transport Decision

## Context

The generation pipeline takes 3–60+ seconds with no progress feedback to the user. The backend tracks 6 workflow stages in SQLite (`workflow_runs` table) but never streams them. The frontend shows only "Generating..." with no indication of progress.

## Options Evaluated

| Transport | Simplicity | Scalability | Local dev | Vercel/Serverless | Long-running support |
|---|---|---|---|---|---|
| **SSE** | High | Moderate | Excellent | Compatible via edge streaming | Excellent — designed for long-lived connections |
| **WebSockets** | Low | High | Good | Requires adapter (WebSocket API) | Excellent |
| **HTTP chunked** | Medium | Moderate | Good | Limited | Good — but manual framing |
| **Polling** | Highest | Low | Excellent | Excellent | Poor — adds latency, wastes resources |

## Recommendation: SSE with Polling Fallback

### Why SSE wins

1. **Unidirectional** — progress is server→client only. WebSocket's bidirectional capability is unused overhead.
2. **Browser-native** — `EventSource` API built into all modern browsers. No libraries needed.
3. **Fastify compatible** — `reply.raw.write()` works with any Fastify deployment.
4. **Restart-safe** — SSE is stateless at the transport level. If the client disconnects and reconnects, the server has no stale connection state.
5. **Local dev** — works out of the box with `pnpm dev`. No WebSocket proxy, no adapter, no config.
6. **Vercel compatible** — Edge Functions support streaming responses. For serverless, the polling fallback handles cases where SSE isn't available.

### Why not WebSockets

- Overkill for one-way progress updates
- Requires connection upgrade handshake (slower initial connect)
- Needs sticky sessions or pub/sub for multi-process deployment
- No built-in reconnection in browser API (need library like `socket.io`)

### Why not polling

- 3-second polling adds up to 20 unnecessary requests in a 60-second generation
- No real-time feel — progress jumps instead of streaming smoothly
- Wasteful for a local-first tool where SSE is simpler

### Why not HTTP chunked

- SSE is literally HTTP chunked with a standardized event format
- Using raw chunked encoding means reinventing SSE's event framing

## Architecture

```
┌──────────┐   workflowId   ┌──────────────┐
│ Frontend │ ──────────────→│   Backend     │
│          │                │              │
│  POST /generate ─────────→│  generateWithAI()
│  { workflowId }           │    │
│          │                │    │ emitProgress("synthesis")
│  ┌──────────────────┐     │    │ emitProgress("analysis")
│  │ EventSource      │←────│────│ emitProgress("blueprint")
│  │ /progress/:wfId  │     │    │ emitProgress("roadmap")
│  └──────────────────┘     │    │ emitProgress("taskGraph")
│          │                │    │ emitProgress("promptGen")
│          │                │    │ emitProgress("complete")
│          │                │    │
│  ←── HTTP 200 blueprint ──│←───┘
└──────────┘                └──────────────┘
```

## Transport Behavior

| Scenario | Transport | Behavior |
|---|---|---|
| Browser supports EventSource | SSE | Real-time streaming of stage updates |
| EventSource fails (network, proxy) | Polling fallback | `GET /api/v1/workflows/:id` every 2s |
| Generation completes | SSE sends `complete` event | Client closes connection |
| Client navigates away | SSE `onclose` | Backend cleans up listener |
| Server crashes mid-generation | No event emitted | Client detects timeout, shows error |

## Progress Event Schema

```typescript
interface ProgressEvent {
  workflowId: string;
  stage: "synthesis" | "analysis" | "blueprint" | "roadmap" | "taskGraph" | "promptGen" | "complete";
  status: "running" | "completed" | "failed";
  message?: string;       // human-readable detail
  attempt?: number;       // which AI attempt (for blueprint stage)
  model?: string;         // AI model used
  provider?: string;      // AI provider used
  timestamp: string;      // ISO 8601
}
```

## Files Changed

| File | What |
|---|---|
| `lib/events/progress-emitter.ts` | EventEmitter-based progress bus. Clean separation: orchestration emits events, transport subscribes. |
| `routes/progress.ts` | SSE endpoint: `GET /api/v1/progress/:workflowId`. Writes `event: progress\ndata: {...}\n\n` for each event. Cleans up on client disconnect. |
| `lib/generation/orchestrator.ts` | Emits `emitProgress()` at each of 7 stages. |
| `lib/use-progress.ts` | React hook: connects to SSE, tracks stage state, exposes `activeStage`, `completedStages`, `stageLabel`. |
| `components/interview/interview-view.tsx` | Generates `workflowId`, passes to generate endpoint, shows live progress bar with stage labels. |
| `lib/api.ts` | `generateBlueprint()` accepts optional `workflowId`. |
| `domains/interview-sessions.ts` | Accepts `workflowId` in request body, passes to `generateWithAI`. |
