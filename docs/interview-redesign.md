# Interview Redesign: Information Architecture

## Category Definitions

| Category | Label | Behavior | Must ask upfront? |
|---|---|---|---|
| **critical** | Critical | Always shown, always required | Yes |
| **high-value** | Important | Always shown, required | Yes |
| **optional** | Optional | Shown, not required for completion | No — can skip |
| **contextual** | Context-dependent | Only shown when gated condition met | Conditional |
| **advanced-only** | Advanced | Hidden from first pass; shown in refinement stage | No — after generation |
| **derivable** | AI-inferred | Not asked; AI estimates with explicit user confirmation | No — AI guesses, user confirms |

## Categorization Matrix

### Phase 1: Ideation & Discovery (5 → 3 upfront + 1 derivable + 1 optional)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 1 | ideation.1 | required | **critical** | Core problem statement → inferred requirement. High-value deterministic extraction. |
| 2 | ideation.2 | required | **high-value** | Platform choice guides all architecture decisions. AI needs this. |
| 3 | ideation.3 | required | **derivable** | Can be derived: new project has no existing code, rebuild has legacy. AI can estimate from context and `ideation.1`. Show as confirmation: "We inferred this is a new product. Correct?" |
| 4 | ideation.4 | required | **high-value** | Scale at launch meaningfully affects architecture, DB, deployment. High signal. |
| 5 | ideation.5 | optional | **optional** | Differentiators are nice-to-know but not essential for generation quality. Move to optional. |

**Upfront minimum: 3 questions** (ideation.1, ideation.2, ideation.4)

### Phase 2: Requirements Engineering (6 → 4 upfront + 1 optional + 1 advanced)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 6 | requirements.1 | required | **critical** | Core features → inferred requirement. Highest value text in the entire interview. |
| 7 | requirements.2 | required | **critical** | Auth gate question. Controls visibility of `requirements.3`. Needed early. |
| 8 | requirements.3 | required | **contextual** | Gated on `requirements.2=true`. Correct already — keep. |
| 9 | requirements.4 | required | **optional** | Roles/permissions can be deferred. AI can assume basic RBAC as default. |
| 10 | requirements.5 | required | **critical** | User workflows → inferred requirement. High value for roadmap. |
| 11 | requirements.6 | optional | **advanced-only** | Integration details belong in refinement, not initial intake. User may not know at start. |

**Upfront minimum: 4 questions** (requirements.1, requirements.2, [requirements.3 conditional], requirements.5)

### Phase 3: System Architecture (4 → 3 upfront + 1 optional)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 12 | architecture.1 | required | **critical** | Tech stack constraints → captured as constraint. Must ask. |
| 13 | architecture.2 | required | **high-value** | Data flow → inferred requirement. Important for roadmap. |
| 14 | architecture.3 | required | **high-value** | Real-time affects architecture fundamentally. Must know. |
| 15 | architecture.4 | required | **optional** | Read/write ratio is a guess. AI can estimate from requirements.5. |

**Upfront minimum: 3 questions** (architecture.1, architecture.2, architecture.3)

### Phase 4: Security Planning (4 → 2 upfront + 1 contextual + 1 optional)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 16 | security.1 | required | **high-value** | PII gate question. Important for compliance. |
| 17 | security.2 | required | **high-value** | Compliance → captured as constraint. Important for architecture. |
| 18 | security.3 | required | **contextual** | Gated on `security.1=true`. Correct — keep. |
| 19 | security.4 | optional | **optional** | Open-ended security concerns are low signal. Keep as optional. |

**Upfront minimum: 2 questions** (security.1, security.2, [security.3 conditional])

### Phase 5: Database Design (3 → 1 upfront + 1 derivable + 1 advanced)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 20 | database.1 | required | **high-value** | Data shape informs DB choice. Useful for architecture. |
| 21 | database.2 | required | **derivable** | Data volume correlates with scale (`ideation.4`). AI can estimate. Show as confirmation. |
| 22 | database.3 | optional | **advanced-only** | Query patterns are a refinement concern. Move to advanced. |

**Upfront minimum: 1 question** (database.1)

### Phase 6: Backend Design (4 → 1 upfront + 2 derivable + 1 optional)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 23 | backend.1 | required | **high-value** | Backend capabilities guide architecture. Keep. |
| 24 | backend.2 | required | **derivable** | Job queue need can be inferred from `backend.1` if user selected "Background job processing." Redundant. |
| 25 | backend.3 | required | **derivable** | API volume correlates with user count (`ideation.4`). AI can estimate. Show as confirmation. |
| 26 | backend.4 | required | **optional** | Multi-tenancy is niche. Most small projects don't need it. Make optional. |

**Upfront minimum: 1 question** (backend.1)

### Phase 7: Frontend Design (3 → 1 upfront + 1 derivable + 1 optional)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 27 | frontend.1 | required | **high-value** | Frontend capabilities guide architecture. Keep. |
| 28 | frontend.2 | required | **derivable** | SSR/SSG need can be inferred from platform (`ideation.2`). Web app → likely SSR. Mobile → native. Show as confirmation. |
| 29 | frontend.3 | required | **optional** | i18n/a11y are important but can be deferred to refinement. Most users select "Neither." |

**Upfront minimum: 1 question** (frontend.1)

### Phase 8: Core Feature Implementation (3 → 1 upfront + 1 optional + 1 advanced)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 30 | core-features.1 | required | **high-value** | Most complex feature helps AI prioritize. Useful. |
| 31 | core-features.2 | optional | **optional** | Microservices question is valid but low priority for initial build. |
| 32 | core-features.3 | optional | **advanced-only** | Third-party reliability assumptions belong in refinement, not initial intake. |

**Upfront minimum: 1 question** (core-features.1)

### Phase 9: AI / Advanced Systems (3 → 1 upfront + 2 contextual)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 33 | ai-systems.1 | required | **high-value** | AI gate question. Important to know upfront. |
| 34 | ai-systems.2 | required | **contextual** | Gated on `ai-systems.1=true`. Correct — keep. |
| 35 | ai-systems.3 | optional | **contextual** | Gated on `ai-systems.1=true`. Already correct — keep as contextual/optional. |

**Upfront minimum: 1 question** (ai-systems.1, [ai-systems.2+3 conditional])

### Phase 10: Testing & Validation (3 → 0 upfront + 2 derivable + 1 advanced)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 36 | testing.1 | required | **derivable** | Coverage targets are standard practice. AI can recommend based on project type. Show as confirmation. |
| 37 | testing.2 | required | **derivable** | Test types are standard. AI can recommend a sensible suite. Show as confirmation. |
| 38 | testing.3 | optional | **advanced-only** | Performance benchmarks are a refinement concern. Move to advanced. |

**Upfront minimum: 0 questions** (all derivable or advanced)

### Phase 11: Deployment (3 → 0 upfront + 2 derivable + 1 optional)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 39 | deployment.1 | required | **derivable** | Hosting choice can be inferred from tech stack + scale. AI recommends, user confirms. |
| 40 | deployment.2 | required | **derivable** | CI/CD is standard practice. AI assumes it. Show as confirmation. |
| 41 | deployment.3 | required | **optional** | Deploy frequency correlates with team size/project stage. Low signal for initial plan. |

**Upfront minimum: 0 questions** (all derivable or optional)

### Phase 12: Monitoring & Maintenance (3 → 0 upfront + 2 derivable + 1 advanced)

| # | Ref | Old | New | Rationale |
|---|---|---|---|---|
| 42 | monitoring.1 | required | **derivable** | Monitoring tools are standard. AI recommends based on stack. Show as confirmation. |
| 43 | monitoring.2 | required | **derivable** | SLA correlates with scale (`ideation.4`). AI estimates. Show as confirmation. |
| 44 | monitoring.3 | optional | **advanced-only** | Operational risks → captured as risk. Important but deferred to refinement. |

**Upfront minimum: 0 questions** (all derivable or advanced)

## Summary

| Category | Count | Old required | New required upfront |
|---|---|---|---|
| **critical** | 4 | 4 | 4 |
| **high-value** | 10 | 10 | 10 |
| **optional** | 6 | 6 | 0 |
| **contextual** | 4 | 4 | 0 (shown conditionally) |
| **advanced-only** | 5 | 0 | 0 |
| **derivable** | 12 | 12 | 0 (AI infers, user confirms) |
| **(merged/removed)** | 4 | — | — |
| **Total** | **45** | **34 required** | **14 upfront critical+high-value** |

## Information Architecture

### Stage 1: Required Intake (14 questions)
```
PHASE 1: Ideation       → ideation.1 (critical), ideation.2 (high-value), ideation.4 (high-value)
PHASE 2: Requirements   → requirements.1 (critical), requirements.2 (critical),
                           requirements.3 (contextual, if auth), requirements.5 (critical)
PHASE 3: Architecture   → architecture.1 (critical), architecture.2 (high-value), architecture.3 (high-value)
PHASE 4: Security       → security.1 (high-value), security.2 (high-value),
                           security.3 (contextual, if PII)
PHASE 5: Database       → database.1 (high-value)
PHASE 6: Backend        → backend.1 (high-value)
PHASE 7: Frontend       → frontend.1 (high-value)
PHASE 8: Core Features  → core-features.1 (high-value)
PHASE 9: AI Systems     → ai-systems.1 (high-value),
                           ai-systems.2+3 (contextual, if AI)
```

### Stage 2: AI Generation
- The AI receives all 14 critical+high-value answers
- The AI also receives suggested values for 12 derivable questions (with confidence markers)
- Generation proceeds with this minimum viable set

### Stage 3: Progressive Refinement (after generation)
```
Optional questions (6):   ideation.5, requirements.4, architecture.4, security.4,
                           backend.4, frontend.3, deployment.3
Advanced-only questions (5): requirements.6, database.3, core-features.3,
                              testing.3, monitoring.3
```
- The generated plan includes placeholders/markers for areas where optional questions were skipped
- User can open refinement panels to answer specific questions and regenerate affected sections

### Stage 4: Derivation Confirmation (12 questions)
```
derivable.1  → ideation.3   (new product vs rebuild)
derivable.2  → database.2   (data volume)
derivable.3  → backend.2    (job queue)
derivable.4  → backend.3    (API volume)
derivable.5  → frontend.2   (SSR/SSG)
derivable.6  → testing.1    (coverage target)
derivable.7  → testing.2    (test types)
derivable.8  → deployment.1 (hosting)
derivable.9  → deployment.2 (CI/CD)
derivable.10 → monitoring.1 (monitoring tools)
derivable.11 → monitoring.2 (SLA)
```
- After generation, the system shows "We assumed X based on your answers — is this correct?"
- User confirms or corrects each derivation
- Confirmed derivations trigger regeneration of affected plan sections
