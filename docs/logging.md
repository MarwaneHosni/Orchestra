# Logging & Observability

## Log Types

The platform produces three distinct log streams:

| Stream      | Prefix                             | Purpose                                   |
| ----------- | ---------------------------------- | ----------------------------------------- |
| Application | `{"level":..., "msg":...}`         | Fastify request logs, orchestration steps |
| Audit       | `{"_audit":true, "eventType":...}` | Sensitive provider actions (immutable)    |
| Generation  | `{"step":"blueprint.*"}`           | Blueprint generation progress             |

## Audit Events

Every sensitive provider action produces an audit entry. These entries are append-only and include redacted metadata.

| Event Type             | When                              | Metadata (redacted)                             |
| ---------------------- | --------------------------------- | ----------------------------------------------- |
| `credential.created`   | New API key stored                | `provider`, `displayName`                       |
| `credential.validated` | Key verification attempted        | `status`, `errorMessage`                        |
| `credential.updated`   | Key or display name changed       | `provider`, `hasNewKey`                         |
| `credential.deleted`   | Credential removed                | `provider`                                      |
| `routing.selected`     | Model selection decision          | `taskType`, `provider`, `model`, `usedFallback` |
| `generation.attempted` | Generation started                | `taskType`, `provider`, `model`                 |
| `generation.completed` | Generation succeeded              | `provider`, `model`, `tokens`                   |
| `generation.failed`    | Generation errored                | `provider`, `model`, `errorCategory`            |
| `budget.blocked`       | Budget check prevented generation | `estimatedCost`, `remainingBudget`              |
| `budget.warning`       | Budget is near limit              | `currentMonthCost`, `maxEstimatedCost`          |

## Redaction Rules

The following rules are enforced in code (`src/lib/audit/redactor.ts`) before any data hits the audit log:

### Keys and fields — redacted by name

| Field names               | Example    | Action                       |
| ------------------------- | ---------- | ---------------------------- |
| `apiKey`, `api_key`       | `"sk-..."` | Replaced with `"[REDACTED]"` |
| `secretKey`, `secret_key` | `"..."`    | Replaced with `"[REDACTED]"` |
| `password`, `token`       | `"..."`    | Replaced with `"[REDACTED]"` |

### Values — redacted by pattern

| Pattern                   | Example                    | Action                       |
| ------------------------- | -------------------------- | ---------------------------- |
| `sk-[A-Za-z0-9]{20,}`     | `sk-test123...`            | Replaced with `"[REDACTED]"` |
| `sk-ant-[A-Za-z0-9]{20,}` | `sk-ant-api03...`          | Replaced with `"[REDACTED]"` |
| `sk-or-[A-Za-z0-9]{20,}`  | `sk-or-v1-...`             | Replaced with `"[REDACTED]"` |
| Base64-like 40+ chars     | `QWxhZGRpbjpPcGVuU2VzYW1l` | Replaced with `"[REDACTED]"` |

### HTTP headers

| Header                 | Action                       |
| ---------------------- | ---------------------------- |
| `authorization`        | Replaced with `"[REDACTED]"` |
| `x-api-key`            | Replaced with `"[REDACTED]"` |
| `cookie`, `set-cookie` | Replaced with `"[REDACTED]"` |

### URLs

| Component       | Action                       |
| --------------- | ---------------------------- |
| Username in URL | Replaced with `"[REDACTED]"` |
| Password in URL | Replaced with `"[REDACTED]"` |

### Provider responses

| Field         | Action                 |
| ------------- | ---------------------- |
| `content`     | Truncated to 500 chars |
| `result_text` | Truncated to 500 chars |
| `prompt_text` | Truncated to 500 chars |

## Redaction enforcement

Redaction is applied at the audit logging layer (`logger.ts`), not at individual call sites. Every `createAuditEntry()` call automatically runs `redactObject()` on the metadata, so callers don't need to remember to redact.

To add new sensitive fields:

1. Add the field name or pattern to `redactor.ts`
2. Tests in `audit.test.ts` verify the new rule

## Failure Spike Detection

The `FailureSpikeDetector` tracks generation failures per provider in a sliding window:

| Parameter | Default    | Description                       |
| --------- | ---------- | --------------------------------- |
| Window    | 5 minutes  | Time window for counting failures |
| Threshold | 3 failures | Number of failures before alert   |

An alert fires when `>= threshold` failures occur within the window for a single provider. The alert includes:

- Provider name
- Failure count
- Time range (first to last failure)

### Distinguishing spike from noise

| Signal                                 | Interpretation                             |
| -------------------------------------- | ------------------------------------------ |
| Single failure, followed by success    | Normal transient error — no alert          |
| 3+ failures in 5 minutes               | Possible outage — alert                    |
| 3+ failures across different providers | Possible network issue — alert             |
| Budget-denied failures only            | Configuration issue — not a provider spike |

## What NOT to log

| Data                          | Why                               |
| ----------------------------- | --------------------------------- |
| Raw API keys                  | Redacted by code in `redactor.ts` |
| Full provider request bodies  | Truncated to 500 chars            |
| Full provider response bodies | Truncated to 500 chars            |
| Authorization headers         | Redacted by code                  |
| Session tokens or cookies     | Redacted by code                  |
| Database connection strings   | URL redaction handles credentials |
| Internal IPs / secrets        | Not included in any log call site |

## Structured Log Format

All logs use JSON format for machine parsing:

### Application log

```json
{
  "level": "info",
  "msg": "request completed",
  "reqId": "req-1",
  "res": { "statusCode": 200 },
  "responseTime": 42
}
```

### Audit log

```json
{
  "_audit": true,
  "eventType": "credential.created",
  "actor": "user-1",
  "resourceId": "cred-1",
  "metadata": { "provider": "openai", "apiKey": "[REDACTED]" },
  "timestamp": "2026-05-15T22:00:00.000Z"
}
```

### Generation step log

```json
{
  "step": "blueprint.generated",
  "sessionId": "...",
  "planVersion": 1,
  "phases": 12,
  "confidence": 0.85,
  "flags": 3
}
```

## Viewing logs in development

```bash
# All logs
pnpm --filter @orchestra/api dev

# Filter to audit events
pnpm --filter @orchestra/api dev 2>&1 | Select-String "_audit"

# Filter to blueprint steps
pnpm --filter @orchestra/api dev 2>&1 | Select-String "blueprint|ambiguity"

# Filter to generation failures
pnpm --filter @orchestra/api dev 2>&1 | Select-String "generation.failed|generation_failed"
```
