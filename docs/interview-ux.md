# Interview UX Redesign

## Design Principles

1. **Progressive disclosure** — Show users only what they need at each step
2. **Context matters** — Every question explains why it's being asked
3. **Visible progress** — Time estimates replace raw question counts
4. **Low pressure** — Optional questions are clearly marked; skipping is normalized
5. **Smart grouping** — 12 phases are compressed into 4 groups for mental model

## Interaction Pattern

```
Phase Intro Screen (5 sec)
  ┌─────────────────────────────────────┐
  │ Foundation · Ideation & Discovery   │
  │ First, let's understand your        │
  │ project idea...                     │
  │                           [Got it →]│
  └─────────────────────────────────────┘

Question Card
  ┌─────────────────────────────────────┐
  │ [Important] [Optional]              │
  │                                     │
  │ What problem does your software     │
  │ solve? Who is the primary audience? │
  │                                     │
  │ Why this matters: Helps define the  │
  │ project scope and target audience.  │
  │                                     │
  │ [textarea]                          │
  │                                     │
  │ [Submit answer] [I'm not sure]      │
  └─────────────────────────────────────┘
```

## What Changed

### Progress Bar (before → after)

| Before | After |
|---|---|
| 12 phase pills in a horizontal scroll | 4 phase group labels (Foundation, Core, Infrastructure, Operations) |
| Shows `answered/total` | Shows `answered/total` + estimated time remaining ("~3 min left") |
| Every phase visible at once | Only current group highlighted; others dimmed |
| Status dots per phase | Single thin progress bar |

### Question Card (before → after)

| Before | After |
|---|---|
| No category label | Badge: "Required" / "Important" / "Optional" / "Context dependent" |
| No "why this matters" | Italic explanation below the question text |
| Hidden "I'm not sure" as a text link | Visible button: "I'm not sure" |
| Full "Tips for answering" accordion (rarely opened) | Removed — content merged into "why this matters" |
| Optional questions not visually distinguished | "Optional" dashed badge on non-required questions |

### Phase Transition (before → after)

| Before | After |
|---|---|
| Phases change silently | Phase intro card shows: group name, phase name, friendly explanation |
| User jumps into questions cold | User gets context before first question in each phase |
| No group context | Group name displayed: "Foundation", "Core", "Infrastructure", "Operations" |

### Completion Screen (before → after)

| Before | After |
|---|---|
| "All questions answered" | "You're all set" — less formal, more encouraging |
| No mention of skipped questions | Explains: "Some advanced questions were skipped — you can refine these after reviewing the plan." |
| Simple phase list | Phase list with dot indicators for skipped vs completed |

## Phase Groups

| Group | Phases | Questions (Quick) | Questions (Advanced) |
|---|---|---|---|
| **Foundation** | Ideation, Requirements, Architecture, Security | 6-7 | 8-10 |
| **Core** | Database, Backend, Frontend, Core Features, AI Systems | 3-4 | 5-7 |
| **Infrastructure** | Testing, Deployment | 0-1 | 2-4 |
| **Operations** | Monitoring | 0-1 | 1-2 |
| **Total** | 12 phases | 10-14 | 16-24 |

## Estimated Time Display

The progress bar shows an estimated time remaining based on unanswered question count:

| Remaining questions | Display |
|---|---|
| 0 | "Complete" |
| 1-5 | "~1 min left" |
| 6-10 | "~2 min left" |
| 11-15 | "~3 min left" |
| 16-24 | "~5 min left" |
| 25+ | Calculated as `ceil(remaining * 0.4) min left` |

## Smart Defaults Strategy

| Question type | Default when user clicks "I'm not sure" |
|---|---|
| text | `"I am not sure yet — do what you think is more optimal"` |
| boolean | `"false"` (conservative: assume no unless specified) |
| select | First option (usually safe default) |
| multi_select | First option |
| scale | `"3"` (neutral midpoint) |

## Resume / Partial Completion UX

- When a user returns to an in-progress interview, the next unanswered question is shown
- Phase intro screen is NOT shown again (already dismissed)
- The progress bar reflects current state from the backend
- "Back to previous question" allows reviewing and editing answers

## Accessibility

- All category badges have sufficient color contrast (orchestra-700 on orchestra-100, etc.)
- Progress bar uses `role="progressbar"` with `aria-valuenow/min/max/text`
- Question headings are focusable via `tabIndex={-1}` for screen reader navigation
- Phase intro dismiss button is keyboard-accessible
- Live announcer broadcasts saves, errors, and phase changes to screen readers
