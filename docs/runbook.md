# Operational Runbook

## Starting the Platform

```bash
# Terminal 1: Database
docker compose up -d

# Terminal 2: API server
pnpm --filter @orchestra/api dev

# Terminal 3: Frontend
pnpm --filter @orchestra/web dev
```

The API starts on `http://localhost:3000`, frontend on `http://localhost:3001`.

---

## Loading Demo Data

```bash
pnpm --filter @orchestra/api exec tsx src/db/demo-seed.ts
```

This seeds a pre-configured project ("TeamSync") with answers to all 44 questions across every phase. The project is loaded into the API's in-memory store on the next server start, so run the seed script before starting the API, or restart the API after seeding.

**Note:** The demo seed replaces the in-memory store. Run it once after starting fresh.

---

## Inspecting Logs

The API uses structured JSON logging via Pino. Each major orchestration step emits a log line:

```json
{"step":"project.created","projectId":"...","sessionId":"...","timestamp":"..."}
{"step":"question.served","sessionId":"...","questionRef":"ideation.1","answered":5,"total":44,"timestamp":"..."}
{"step":"answer.submitted","sessionId":"...","questionId":"ideation.1","isEdit":false,"changed":false,"length":42,"timestamp":"..."}
{"step":"session.ready_for_generation","sessionId":"...","total":44,"answered":44,"timestamp":"..."}
{"step":"blueprint.generation_started","sessionId":"...","projectId":"...","existingPlanCount":0,"timestamp":"..."}
{"step":"blueprint.generated","sessionId":"...","planId":"...","planVersion":1,"phases":12,"confidence":0.85,"flags":3,"timestamp":"..."}
{"step":"blueprint.completed","sessionId":"...","planVersion":1,"timestamp":"..."}
{"step":"blueprint.generation_failed","sessionId":"...","planVersion":1,"error":"...","timestamp":"..."}
```

### Viewing logs in development

Logs stream to stdout in the API terminal. Filter by step:

```bash
# PowerShell
pnpm --filter @orchestra/api dev 2>&1 | Select-String "blueprint"

# bash
pnpm --filter @orchestra/api dev 2>&1 | grep blueprint
```

### Log levels

| Level   | When             | What it means                        |
| ------- | ---------------- | ------------------------------------ |
| `info`  | Normal operation | Request completed, step executed     |
| `warn`  | Degraded state   | Ambiguity detected, retry occurred   |
| `error` | Failure          | Generation failed, request errored   |
| `fatal` | Unrecoverable    | Server cannot start (missing config) |

---

## Common Failures & Recovery

### 1. Blueprint generation fails

**Symptoms:**

- `POST /api/v1/interviews/:id/generate` returns 500
- Log shows `"step":"blueprint.generation_failed"`
- Session remains in `ready_for_generation` state

**Cause:** Usually an unexpected error in the blueprint generator (ambiguity detection, confidence scoring, or a bug in the question definitions).

**Recovery:**

1. Check the error message in the log
2. Fix the underlying issue (e.g., add missing question handler)
3. Call `POST /api/v1/interviews/:id/generate` again to retry
4. The retry creates a new plan version — no data is lost

The existing failed plan (if any was created) remains as an orphan record. It has no associated blueprint and will not appear in the UI.

### 2. Session stuck in wrong state

**Symptoms:**

- `GET /api/v1/interviews/:id/next` returns unexpected results
- Session status doesn't match expected flow

**Recovery:**

```bash
# Force transition to a valid state
curl -X POST http://localhost:3000/api/v1/interviews/<sessionId>/transition \
  -H "Content-Type: application/json" \
  -d '{"toStatus":"in_progress"}'
```

Valid transitions:

- `draft` → `in_progress`
- `in_progress` → `waiting_for_answers` (via GET /next)
- `waiting_for_answers` → `in_progress` (via POST /answers)
- `in_progress` or `waiting_for_answers` → `ready_for_generation`
- `ready_for_generation` → `completed` (via POST /generate)

### 3. Answer edit doesn't take effect

**Symptoms:**

- Submitting an edited answer still shows old value in progress
- Blueprint doesn't reflect the change

**Cause:** The progress indicator (`answered` count) counts unique question IDs from the latest answers only. If the count seems wrong, the session might be counting stale answers.

**Recovery:**

1. Verify: `GET /api/v1/interviews/:id/answers` shows the latest answer
2. If needed, call `POST /api/v1/interviews/:id/generate` to regenerate with latest answers
3. The new blueprint will have a higher version number

### 4. Server won't start

**Symptoms:**

- API exits immediately with a configuration error

**Check:**

```bash
# Verify environment variables are set
# Required: none (all have defaults)
# Required for DB: DATABASE_URL
# Required for AI features: OPENAI_API_KEY or ANTHROPIC_API_KEY

# Check Node.js version
node --version  # Must be >= 20
```

---

## Resetting State

### Reset the in-memory store

The store is a module-level singleton. To reset:

1. Stop the API server
2. Restart it — the in-memory store is empty on startup
3. Re-run demo seed if needed

### Reset the database

```bash
pnpm db:reset        # Drops and recreates the logical database
pnpm db:migrate      # Re-applies all migrations
pnpm db:seed         # Re-seeds question definitions
```

---

## Health Checks

| Endpoint             | Purpose   | Expected                                        |
| -------------------- | --------- | ----------------------------------------------- |
| `GET /health`        | Liveness  | `{"status":"ok"}`                               |
| `GET /ready`         | Readiness | `{"status":"ok","database":"connected"}`        |
| `GET /api/v1/status` | Version   | `{"service":"orchestra-api","version":"0.1.0"}` |

---

## Retry Strategy

The blueprint generator uses the following retry semantics:

1. **Automatic retry**: None. Generation failures surface the error to the caller.
2. **Manual retry**: Re-call `POST /api/v1/interviews/:id/generate`. The session stays in `ready_for_generation` on failure.
3. **Version safety**: Each retry creates a new plan version (`existingPlans.length + 1`). No versions are overwritten.
4. **Orphan plans**: Failed attempts may leave a plan row with no corresponding blueprint. These are harmless and can be ignored or cleaned up manually.

No background job queue is used. Generation runs synchronously in the request-response cycle. If this becomes a bottleneck, a future phase can extract generation into a worker process.
