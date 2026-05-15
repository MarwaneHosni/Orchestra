# UX Improvement Specification — Phase 5

## 1. UX Audit Summary

### 1.1 Current User Flow

```
Landing (/) ──► Create Project (/projects/new)
                    │
                    ▼
              Interview Wizard (/projects/[sessionId]/interview)
                    │  (server-driven questions, 12 phases)
                    ▼
              Generate Blueprint
                    │
                    ▼
              Summary Page (/projects/[sessionId]/summary)
                    │  (read-only blueprint)
                    │
                    ▼ (manual URL navigation — no in-app link)
              Task Graph (/projects/[sessionId]/tasks)
```

### 1.2 Key Issues Found

| #   | Issue                                                                     | Location           | Impact                                                                    |
| --- | ------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| 1   | URL param `[id]` is a sessionId, not a projectId — naming is misleading   | All project routes | Confusion; no way to reach a project by its real ID                       |
| 2   | No project detail/home page — `/projects/[id]` returns 404                | Missing route      | Users land on a "dead" URL after interview redirect                       |
| 3   | Project list (`/projects`) is hardcoded empty — never fetches real data   | `/projects`        | No project history or status overview                                     |
| 4   | Dashboard stats are hardcoded zeros — never fetch from API                | `/`                | First impression is empty/static                                          |
| 5   | Summary page is a dead end — no button to reach task graph                | Summary view       | Users must know the `/tasks` URL manually                                 |
| 6   | No in-app breadcrumbs — no way to see "Projects > My Project > Interview" | Global             | Users get lost in the flow                                                |
| 7   | Progress bar shows phases but not their sufficiency status                | Interview          | No feedback that a phase has `insufficient` or `missing` answers          |
| 8   | No "what is missing?" prompt after low-confidence answers                 | Interview          | Phase status issues only surface in the summary, not during the interview |
| 9   | No answer review screen before generating the plan                        | Interview end      | User commits to generation without seeing their full answers              |
| 10  | Task graph has no link to the summary or back to the project              | Task graph         | Orphaned view — no context for where tasks came from                      |
| 11  | The "New project" hero button links to `/projects` not `/projects/new`    | Landing            | Extra click for the primary action                                        |
| 12  | Interview back-navigation uses approximate `phaseIndex` arithmetic        | Interview          | Can land on wrong phase after multiple back/forward cycles                |

### 1.3 Chat-like Patterns Identified

| Pattern                        | Where         | Why it's a problem                                                                         |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------ |
| Single-column question flow    | Interview     | Feels like a one-way chat with no overall structure visible                                |
| No sidebar progress breakdown  | Interview     | Users can't see which phases are done, which are missing detail                            |
| No answer review before submit | Interview     | Unlike a structured form, there's no "review your answers" step                            |
| Generation after last answer   | Interview end | Abrupt transition — user clicks "Generate" and is thrown into a summary without transition |

### 1.4 Dense Areas Identified

| Area                      | Elements packed                                                                                                          | Cognitive load problem                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Summary page              | Project name + version + date + 3 metric cards + 12 phase rows + assumptions + constraints + risks + flags (7+ sections) | Users scan past critical flags and insufficient phases because everything has equal visual weight                  |
| Phase progress bar        | 12 phase dots in a single horizontal row                                                                                 | At any screen width below ~900px, dots become too small to distinguish status; phase names are hidden or truncated |
| Task node card            | Title + type badge + priority badge + status dot + border color + dep count + click target                               | Users see "wall of cards" without being able to quickly identify which tasks are actionable vs blocked             |
| Interview question screen | Progress bar + question text + input area + submit/skip buttons + back button + optional help text                       | No visual separation between "where am I" (phase context) and "what to do now" (the question)                      |

---

## 2. Information Architecture Recommendations

### 2.1 Project-Centric Hierarchy (Proposed)

```
/projects                               → Project list (real data)
  /projects/new                         → Create project form
  /projects/[projectId]                 → Project home (phase-aware landing page)
      /projects/[projectId]/interview   → Structured interview wizard
      /projects/[projectId]/summary     → Blueprint review
      /projects/[projectId]/tasks       → Task graph & execution
```

### 2.2 Page Responsibilities

| Page         | Purpose                                                                                          | When is it the landing?                              |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Project list | Show all projects with status badges, creation dates, next action                                | Default after `/` (via "Projects" in nav)            |
| Project home | Show the current phase of ONE project, key metrics, and a clear call-to-action for the next step | After creating a project; after any breadcrumb click |
| Interview    | Answer questions per phase with progress tracking                                                | When project status is `draft` or `in_progress`      |
| Summary      | Review blueprint, phase status, flags, assumptions                                               | When project status is `blueprint_generated`         |
| Task graph   | View and export the dependency graph                                                             | When project status is `planning_complete`           |

### 2.3 Single Question Screen Hierarchy (Interview Step)

Each interview question screen follows a strict vertical stack. Every element has a fixed position and purpose — nothing is reordered:

```
┌─────────────────────────────────────────────────────────┐
│  Breadcrumb: Projects > "Project Name" > Interview      │  ← persistent
├─────────────────────────────────────────────────────────┤
│  Step Indicator: ● Interview — ○ Review — ○ Tasks       │  ← persistent
├─────────────────────────────────────────────────────────┤
│  Phase context: "Phase 3 of 12 — Architecture"          │  ← phase label
│  Per-phase progress: "Question 2 of 3"                  │  ← question counter
│  Phase status dot: ● in progress / ✓ sufficient / ⚠ ins.│  ← current phase health
├─────────────────────────────────────────────────────────┤
│  ┌─── "What's missing?" notice (conditional) ──────┐   │  ← shown only when
│  │  ⚠ Previous phase "Requirements" is insufficient │   │    previous phase
│  │  [Provide more detail] [Continue as-is]          │   │    ended with issues
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Question card (bordered, white bg):                     │  ← the actual question
│    Question text                                         │
│    [Input: textarea | radio | checkbox | boolean | scale]│  ← type-dependent
│    [Submit answer] [Skip]                                │
│    ┌─ Show tips ▼ ──────────────────────────┐            │  ← expandable
│    │  Agent tips for this question...        │            │
│    └─────────────────────────────────────────┘            │
├─────────────────────────────────────────────────────────┤
│  [← Back to previous question] (conditional)             │  ← bottom, de-emphasized
└─────────────────────────────────────────────────────────┘
```

Rules:

- **Phase context** must be the first thing below the step indicator — users must always know which phase they're in
- **Question card** is the only interactive element at the page's visual focal point (center)
- **"What's missing?" notice** sits between phase context and question card — it's visible but doesn't compete with the question
- **Agent tips** are collapsed by default; the "Show tips" toggle is part of the question card
- **Back button** is at the bottom, de-emphasized (gray text, not a button) — forward progress is the primary action

### 2.4 Project Home Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│  [Breadcrumb: Projects > My Project]                         │
│                                                              │
│  Project Name                          Status: In Progress   │
│  Created: May 15, 2026                                       │
│                                                              │
│  ┌─────────────── Phase Roadmap ──────────────────────────┐  │
│  │                                                         │  │
│  │  Step 1: Interview    ● ● ○ ○ ● ● ○ ● ○ ○ ● ●         │  │
│  │          (7/12 phases complete)                         │  │
│  │                                                         │  │
│  │  Step 2: Review Plan    [not ready until interview done]│  │
│  │                                                         │  │
│  │  Step 3: Explore Tasks  [not ready until plan reviewed] │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Continue Interview]  (primary CTA)                         │
│                                                              │
│  Summary of answers so far...                                │
└──────────────────────────────────────────────────────────────┘
```

### 2.5 Project List Row Structure

Each project in the list appears as a single horizontal row:

```
┌──────────────────────────────────────────────────────────────────┐
│  ● Project Name                            Draft     May 15, 2026 │
│  Short description or idea summary (one line, truncated)         │
│                                              [Continue →]         │
└──────────────────────────────────────────────────────────────────┘
```

Elements (left to right):

1. **Status dot** — colored circle (gray=draft, blue=in_progress, green=complete, amber=needs_review)
2. **Project name** — linked to project home (`/projects/[id]`)
3. **Status badge** — pill badge: "Draft", "In Progress", "Blueprint Ready", "Plan Complete"
4. **Date** — creation or last-updated date
5. **CTA** — "Continue" or "View" button, text depends on current status
   - Draft/in_progress: "Continue interview"
   - Blueprint ready: "View plan"
   - Plan complete: "View tasks"

### 2.6 Route-Level Items

The project list and dashboard **must fetch real data**. Hardcoded empty states are not acceptable for Phase 5. At minimum:

- `GET /api/v1/projects` — returns `[{ id, name, status, createdAt }]`
- Dashboard `GET /api/v1/projects/stats` — returns `{ projectCount, interviewCount, planCount }`

Until these API endpoints exist, the frontend should derive stats from the project list, not display hardcoded zeros.

---

## 3. Guided Flow Requirements

### 3.1 Phase-to-Navigation Mapping

Each project status maps to exactly one "active" page and a set of "available" pages:

| Project status         | Active page              | Also accessible                              |
| ---------------------- | ------------------------ | -------------------------------------------- |
| `draft`                | Interview                | Project home                                 |
| `in_progress`          | Interview                | Project home                                 |
| `ready_for_generation` | Interview (review state) | Project home                                 |
| `generating`           | Summary (loading)        | Project home                                 |
| `blueprint_generated`  | Summary                  | Project home, Interview (read-only)          |
| `planning_complete`    | Task graph               | Project home, Summary, Interview (read-only) |

### 3.2 Interview Flow with Phase Awareness

The interview must be restructured from "one question after another" to **"per-phase question sets with visible boundaries"** :

```
Interview /
  Phase 1: Ideation    [3 questions answered]      ✓ sufficient
  Phase 2: Requirements [2 questions answered, 1 skipped]  ⚠ needs review
  Phase 3: Architecture [current — 1/3 answered]    ● in progress
  Phase 4: Security     [not started]               ○ pending
  ...
  Phase 12: Monitoring  [not started]               ○ pending
```

Rules:

- Questions stay server-driven (backend decides next question)
- But the UI shows which phase the current question belongs to
- After finishing a phase, show a per-phase summary before advancing
- If phase status is `insufficient`, show a "What's missing?" prompt

### 3.3 Completion States per Phase

| State        | Visual                             | Behavior                                                             |
| ------------ | ---------------------------------- | -------------------------------------------------------------------- |
| Not started  | Gray dot, dimmed label             | No questions answered in this phase                                  |
| In progress  | Blue dot, normal label             | Some questions answered, phase not done                              |
| Sufficient   | Green checkmark                    | All required questions answered with adequate detail                 |
| Insufficient | Amber tilde + "needs review" badge | Required questions answered but confidence is low or content is thin |
| Missing      | Red X + "missing input" badge      | No answers provided for critical questions                           |

### 3.4 From Interview to Summary

Current flow: Last answer → "Generate" button → immediate navigation.

Proposed flow:

1. After last answer → show **"Interview complete — review your answers before generating"** screen
2. Per-phase summary showing: phase name, status (sufficient/insufficient/missing), confidence, answer count, ambiguity flags
3. Two choices:
   - **Back to review answers** → jump to any phase with `insufficient` or `missing` status
   - **Generate project plan** → proceed to blueprint generation with loading state

### 3.5 From Summary to Task Graph

Current flow: No link exists.

Proposed: After summary displays, add:

- **"View task graph"** button (appears after generation completes)
- Animated transition or "Readiness check" showing: plan version, task count, dependency count, export availability
- The task graph becomes accessible immediately; export is available once tasks have prompts

---

## 4. "What Is Missing?" Prompt Placement Rules

### 4.1 During Interview — Per-Phase Completion Check

**Triggers:**

- User submits last answer for a phase
- Backend marks phase as `insufficient` (confidence < 0.4) or `missing` (no answers)

**Prompt behavior:**

- Inline notice below the next question:
  ```
  ┌──────────────────────────────────────────────────────────┐
  │ ⚠ Phase "Requirements" could use more detail.          │
  │                                                         │
  │ • You marked "Database" as "PostgreSQL" but didn't     │
  │   specify the hosting strategy (self-hosted vs cloud).  │
  │ • The "scaling requirements" answer is less than 10    │
  │   characters — consider elaborating.                    │
  │                                                         │
  │ [Provide more detail →] [Continue as-is →]              │
  └──────────────────────────────────────────────────────────┘
  ```
- Clicking "Provide more detail" navigates back to the insufficient question(s)
- Clicking "Continue as-is" dismisses the prompt and marks the phase with a permanent "needs review" badge

**Placement:** Between the progress bar and the question card.

### 4.2 On Summary Page — Per-Phase Action Items

**For each `insufficient` or `missing` phase:**

- Row is amber/red-highlighted (already done)
- Additional action button: **"Return to interview"** that navigates to the specific phase in the interview
- Phase card shows a second line: _"2 answers provided, 1 missing — hosting strategy not specified"_

### 4.3 On Task Graph — Per-Task Failure Reason

**For each `needs_review` task:**

- Task card shows amber border + dot (already done in UI)
- Task detail panel shows `failureReason` text in an amber notice box (currently missing)
- Prompt artifact shows `promptValidationStatus` and `promptFailureReason` (available from API, not surfaced in UI)

**Placement:** In `TaskDetail` panel, between the status badge and the dependencies list:

```
┌─────────────────────────────────────────────────────────┐
│  ⚠ Needs Review                                         │
│  Phase "Requirements" has status "insufficient" —       │
│  some tasks may lack full context.                      │
│                                                         │
│  [Return to interview →]                                │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Display Rules Summary

| Context       | Condition                              | Prompt type                             | Action                                   |
| ------------- | -------------------------------------- | --------------------------------------- | ---------------------------------------- |
| End of phase  | Phase marked `insufficient` by backend | Inline notice                           | "Provide more detail" / "Continue as-is" |
| End of phase  | Phase marked `missing` by backend      | Inline notice                           | "Answer questions" / "Skip phase"        |
| Summary load  | Any phase `insufficient` or `missing`  | Per-phase action row                    | "Return to interview (phase X)"          |
| Task detail   | Task status is `needs_review`          | Amber notice in detail panel            | "Return to interview"                    |
| Export bundle | Bundle includes warnings               | Per-task `promptValidationStatus` shown | N/A (user must revisit interview)        |

---

## 5. Navigation & Completion-State Specification

### 5.1 Breadcrumb Structure

Every project page shows:

```
Projects  >  Project Name
                  ├─ Interview  [shown when status = draft/in_progress]
                  ├─ Summary    [shown when status = blueprint_generated]
                  └─ Tasks      [shown when status = planning_complete]
```

Rules:

- Breadcrumb items are links except for the current page
- Project Name links to `/projects/[projectId]` (project home)
- Only phases that have been reached are shown (e.g., "Tasks" is hidden until planning is complete)
- States are shown as text labels (not icons alone)

### 5.2 Step Indicator

A persistent horizontal step indicator replaces the current progress bar. It appears on interview, summary, and task graph pages:

```
  ● Interview ────○ Review ────○ Tasks
     (active)      (locked)     (locked)
```

| State    | Visual                                     | Behavior                                               |
| -------- | ------------------------------------------ | ------------------------------------------------------ |
| Active   | Filled circle, bold label                  | Current page                                           |
| Complete | Filled circle with checkmark, normal label | Link to that page                                      |
| Locked   | Outline circle, dimmed label               | Tappable, shows tooltip "Complete the interview first" |

Step labels:

1. **Interview** — Available from project creation through blueprint generation
2. **Review** — Available after blueprint is generated (includes summary + task graph view)
3. **Tasks** — Available after plan is complete (export + dependency view)

### 5.3 Draft States

| State                | Where it appears | What the user sees                        |
| -------------------- | ---------------- | ----------------------------------------- |
| Project is `draft`   | Project list row | Gray badge "Draft", no date               |
| Project is `draft`   | Project home     | "Start interview" CTA, no other content   |
| Interview is `draft` | Interview page   | "Press 'Start' to begin" with explanation |

### 5.4 Completion States

| State               | Where it appears      | What the user sees            |
| ------------------- | --------------------- | ----------------------------- |
| Interview complete  | Project list row      | Green "Interview done" badge  |
| Blueprint generated | Project list row      | Green "Blueprint ready" badge |
| Plan complete       | Project list row      | Green "Plan complete" badge   |
| Interview complete  | Phase in progress bar | Green checkmark on phase dots |

---

## 6. Progressive Disclosure & Answer Refinement

### 6.1 Progressive Disclosure Rules

| Screen element                | Default visibility    | Expansion trigger                           |
| ----------------------------- | --------------------- | ------------------------------------------- |
| Phase roadmap on project home | Shown (collapsible)   | Always visible                              |
| Per-question agent tips       | Hidden                | "Show tips" toggle below question           |
| Ambiguity flags on summary    | Shown as badges       | Click to expand detail                      |
| Task dependency details       | Summary count on card | Click task card → detail slide-over         |
| Prompt text                   | Hidden                | "View Prompt" button in task detail         |
| Export bundle                 | Hidden                | "Export bundle" button in task graph header |
| Answer history                | Hidden                | "Review answers" at end of interview        |

### 6.2 Answer Refinement Flow

Users should be able to revisit and refine answers **without losing progress**:

1. **During interview:** The "Back" button goes to the previous question (current behavior, but needs improved phase tracking)
2. **After interview, before generation:** The review screen shows all phase summaries. Click any phase → jump to that phase's questions → edit → return to review
3. **After generation:** Returning to the interview resets the blueprint (creates a new version) with a confirmation dialog:
   ```
   ┌──────────────────────────────────────────┐
   │  Editing answers will regenerate your    │
   │  plan. Current blueprint v1 will be      │
   │  preserved as a prior version.           │
   │                                          │
   │  [Cancel]  [Edit answers & regenerate]   │
   └──────────────────────────────────────────┘
   ```
4. **After task graph creation:** Same confirmation, but also warns about dependent tasks

### 6.3 Project History Visibility

| View                | Content                                      | How to reach                          |
| ------------------- | -------------------------------------------- | ------------------------------------- |
| Project list        | All projects with status, date, next step    | Navbar "Projects"                     |
| Single project      | Phase roadmap, current step, recent activity | Click project from list               |
| Blueprint history   | All blueprint versions per project           | Project home → "Version history" link |
| Task graph versions | Version selector on task graph page          | Task graph → version dropdown         |

---

## 7. Loading, Empty & Error State Definitions

Every new or redesigned screen must define all three states before implementation.

### 7.1 Project List (`/projects`)

| State   | Visual                                                 | Notes                                               |
| ------- | ------------------------------------------------------ | --------------------------------------------------- |
| Loading | 3 skeleton rows (animated pulse)                       | Same height as a real row                           |
| Empty   | "No projects yet" + "Create your first project" button | Not a dashed border — plain card with centered text |
| Error   | Red banner: "Could not load projects. [Retry]"         | Retry button calls fetch again                      |
| Loaded  | Table rows per Section 2.5                             | —                                                   |

### 7.2 Project Home (`/projects/[projectId]`)

| State   | Visual                                                       | Notes                                  |
| ------- | ------------------------------------------------------------ | -------------------------------------- |
| Loading | Skeleton: breadcrumb bar + phase roadmap (3 gray rectangles) | One skeleton per step in roadmap       |
| Error   | Red banner: "Could not load project. [Retry]"                | Retry calls `GET /api/v1/projects/:id` |
| Loaded  | Phase roadmap + status CTA per Section 2.4                   | —                                      |

### 7.3 Interview Question Screen

| State                 | Visual                                                               | Notes                                                           |
| --------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Loading               | Skeleton: phase label bar + question card outline (2 pulsing blocks) | Not 3 random divs — exact question card shape                   |
| Error (no question)   | Red banner: "Could not load next question. [Retry]"                  | Retry calls `getNextQuestion()`                                 |
| Error (submit failed) | Inline red text below submit button                                  | "Failed to save answer. [Try again]" — does not clear the input |
| No more questions     | Transition to review screen (Section 3.4)                            | Never shows an empty question card                              |
| Backend unavailable   | Banner: "Interview service unavailable. Your answers are saved."     | Does not block navigation                                       |

### 7.4 Summary / Blueprint (`/projects/[projectId]/summary`)

| State                 | Visual                                                           | Notes                                                 |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Loading (generating)  | Spinner + "Generating your project plan..." + estimated time     | Not a generic skeleton — communicates progress        |
| Generation failed     | Red banner: "Generation failed. [Retry]" + "Return to interview" | Two choices, not one                                  |
| Loaded (no blueprint) | "No blueprint found for this project." + "Generate plan" button  | Handles the case where generation was never triggered |
| Loaded (with data)    | Full blueprint display per existing SummaryView                  | Add "View task graph" button                          |

### 7.5 Task Graph (`/projects/[projectId]/tasks`)

| State             | Visual                                                                      | Notes                                                    |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Loading           | Grid of 6 skeleton cards                                                    | Mimics the task card grid shape                          |
| Empty             | "No tasks generated yet. Complete the interview first." + link to interview | Not a dashed border — contextual action                  |
| Error             | Red banner: "Could not load task graph. [Retry]"                            | Retry calls `GET /api/v1/plans/:id/tasks`                |
| Version not found | Banner: "Version {N} not found. Showing latest." + auto-fallback            | Never leaves the user on an error page for version param |
| Export failed     | Red banner below the export button                                          | "Export failed: {message}. [Try again]"                  |

### 7.6 Step Indicator (shared)

| State            | Visual                                                        |
| ---------------- | ------------------------------------------------------------- |
| Loading          | 3 gray dashes (no circles) — same width as real indicator     |
| Interview active | ● Interview (filled) — ○ Review (outline) — ○ Tasks (outline) |
| Review active    | ✓ Interview (check) — ● Review (filled) — ○ Tasks (outline)   |
| Tasks active     | ✓ Interview (check) — ✓ Review (check) — ● Tasks (filled)     |

---

## 8. Mobile & Responsive Considerations

The following screens must work at 320px–1440px widths. This section defines constraints; the next prompt will define exact breakpoints.

| Screen                    | Narrow (<640px) constraint                                                                             | Medium (640–1024px) constraint                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Interview question        | Phase context collapses to icon-only; question card is full-width; back button moves into a bottom bar | Phase context shows abbreviated name; question card has 32px side margin |
| Summary page              | Metric cards stack 1 column; phase rows are compact (remove confidence %, keep only badge)             | Metric cards go 2 columns; full layout                                   |
| Task graph                | Phase sections collapse to accordion (expand one at a time); task cards go 1 column                    | Phase sections always visible; cards go 2 columns                        |
| Project home              | Roadmap steps stack vertically; metrics hide                                                           | Roadmap in 3-column grid                                                 |
| Project list              | Date column hides; CTA becomes icon-only                                                               | Full row layout                                                          |
| Progress dots (interview) | Phase dots replaced by "Phase {N} of 12" text counter                                                  | Full dot row shown                                                       |

All slide-over panels (TaskDetail, PromptPreview) must stay full-screen-width on narrow viewports (not overlay).

---

## 9. Backend Dependencies for UX Improvements

> **Note:** Sections 7 and 8 define loading states, error states, and responsive constraints. Those sections must be read before implementing the changes below.

The following API changes are required before UI implementation:

| Endpoint                                   | Purpose                              | Priority |
| ------------------------------------------ | ------------------------------------ | -------- |
| `GET /api/v1/projects`                     | Real project list data               | P0       |
| `GET /api/v1/projects/stats`               | Real dashboard stats                 | P0       |
| `GET /api/v1/projects/:id`                 | Single project with status + version | P0       |
| `GET /api/v1/interviews/:sessionId/phases` | Per-phase status for progress bar    | P1       |
| `GET /api/v1/plans/:planId/versions`       | List of versioned plans for history  | P2       |

---

## 10. Summary of Concrete Changes Needed

### 10.1 Frontend (apps/web)

| #   | Change                                        | Component                               | Source of truth                         |
| --- | --------------------------------------------- | --------------------------------------- | --------------------------------------- |
| 1   | Project list fetches real data                | `app/projects/page.tsx`                 | `GET /api/v1/projects`                  |
| 2   | Dashboard fetches real stats                  | `app/page.tsx`                          | `GET /api/v1/projects/stats`            |
| 3   | Create new project navigates using projectId  | `app/projects/new/page.tsx`             | URL param changes                       |
| 4   | Project home page at `/projects/[projectId]`  | New component                           | Phase roadmap, status CTA               |
| 5   | Add step indicator to interview/summary/tasks | New `StepIndicator` component           | Phase 5 UX spec §5.2                    |
| 6   | Add breadcrumbs to all project pages          | New `Breadcrumb` component              | Phase 5 UX spec §5.1                    |
| 7   | Add "What's missing?" inline prompts          | `interview-view.tsx`, `task-detail.tsx` | Phase 5 UX spec §4                      |
| 8   | Add per-phase status to progress bar          | `progress-bar.tsx`                      | `GET /api/v1/interviews/.../phases`     |
| 9   | Add interview review screen before generation | `interview-view.tsx` (end state)        | Phase 5 UX spec §3.4                    |
| 10  | Add "View task graph" button to summary       | `summary-view.tsx`                      | `GET /api/v1/plans/.../tasks`           |
| 11  | Fix `dummy` session ID in PromptPreview       | `prompt-preview.tsx`                    | Use real sessionId prop                 |
| 12  | Surface `failureReason` in TaskDetail         | `task-detail.tsx`                       | `task.failureReason` field              |
| 13  | Add version selector to task graph            | `task-graph-view.tsx`                   | `GET /api/v1/plans/.../tasks?version=N` |
| 14  | Implement project list row per §2.5           | `app/projects/page.tsx`                 | Phase 5 UX spec §2.5                    |
| 15  | Implement new loading/error states per §7     | All pages                               | Phase 5 UX spec §7                      |
| 16  | Mobile layout constraints per §8              | All pages                               | Phase 5 UX spec §8                      |

### 10.2 Backend (apps/api)

| #   | Change                                                  | File                   | Source of truth                        |
| --- | ------------------------------------------------------- | ---------------------- | -------------------------------------- |
| B1  | Add `GET /api/v1/projects` endpoint                     | New domain or existing | Real project data with status          |
| B2  | Add `GET /api/v1/projects/stats` endpoint               | New domain or existing | Aggregate project stats                |
| B3  | Add `GET /api/v1/projects/:id` endpoint                 | New domain or existing | Single project details                 |
| B4  | Add `GET /api/v1/interviews/:sessionId/phases` endpoint | Interview domain       | Per-phase status from latest blueprint |
| B5  | Pass `sessionId` to PromptPreview via props             | execution-tasks route  | Fix `dummy` bug                        |

---

## 11. Validation Trace

### 11.1 Against Prompt Validation Criteria

| Criterion                                                                 | How the spec addresses it                                                                               | Section                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| The proposed flow clearly supports an engineering-style guided interview  | Phase-aware question structure, step indicator, per-phase completion states, review-before-generate     | 2.3, 3.1, 3.2, 3.4     |
| Completion states and missing-input cues are defined                      | 5-state phase completion table; 4 "What's missing?" placement rules with triggers, visuals, and actions | 3.3, 4.4               |
| The structure is suitable for implementation in frontend and backend work | Concrete change matrix (14 frontend + 4 backend) with file names, component names, and API endpoints    | 10.1, 10.2             |
| No major screens or transitions remain ambiguous                          | All 9 screens defined with hierarchy, states (loading/empty/error/loaded), and entry/exit transitions   | 2.2, 7.1–7.6, 3.4, 3.5 |

### 11.2 Screen & Transition Coverage Matrix

| Screen                                 | Entry from                      | Exit to                         | States defined                                   | Hierarchy defined           |
| -------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------------------------ | --------------------------- |
| Landing (`/`)                          | URL nav                         | Create project, Project list    | Loading, Error                                   | Existing                    |
| Project list (`/projects`)             | Navbar                          | Project home, Create project    | Loading, Empty, Error, Loaded                    | 2.5 (row)                   |
| Create project (`/projects/new`)       | "New project" button            | Interview (project home)        | Loading, Error                                   | Existing                    |
| Project home (`/projects/[projectId]`) | Project list, breadcrumb        | Interview, Summary, Task graph  | Loading, Error, Loaded                           | 2.4                         |
| Interview question                     | Project home, auto-redirect     | Review screen, next question    | Loading, Error (no Q), Error (submit), No more Q | 2.3                         |
| Interview review (new)                 | After last question             | Summary, back to phase          | (always loaded from history)                     | 3.4                         |
| Summary/blueprint                      | Interview review, auto-redirect | Task graph, Interview (re-edit) | Loading (generating), Gen failed, Empty, Loaded  | 7.4                         |
| Task graph                             | Summary (button), direct nav    | Export, version switch          | Loading, Empty, Error, Version not found         | Existing + version selector |
| Settings                               | Navbar                          | —                               | Loading, Empty, Error                            | Existing                    |

**Every screen has a defined entry, exit, and set of states. No orphan screens or dead-end transitions remain.**

### 11.3 Against Constraints

| Constraint                                         | How the spec respects it                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Do not implement UI changes yet                    | Spec specifies WHAT to build, not pixel-level layout                   |
| Do not redesign into generic dashboard/chat        | Keeps structured 12-phase interview; avoids free-form chat             |
| Keep workflow structured and step-oriented         | Step indicator + phase-aware progress + per-phase status               |
| Do not introduce new product concepts              | All concepts already exist (phases, sessions, blueprints, task graphs) |
| Prioritize clarity, completion, low cognitive load | "What's missing?" prompts, per-phase completion, answer review         |
