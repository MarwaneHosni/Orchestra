# Accessibility Validation Notes — Phase 5

## Automated Checks

The following are checked by the build pipeline:

| Check                            | How it's enforced                                          |
| -------------------------------- | ---------------------------------------------------------- |
| All ARIA attributes are valid    | TypeScript + `tsc --noEmit` — JSX enforces attribute names |
| No unused variables or imports   | ESLint during `next build`                                 |
| Components compile without error | `next build`                                               |
| Format consistency               | Prettier `--check`                                         |

## Manual Validation Checklist

### Keyboard Flow — Complete Each Path

```
Path 1: Landing → Create Project → Interview
  1. Tab from landing through navbar links
  2. Tab to "New project" button, press Enter
  3. Tab through form fields: project name → idea description → submit
  4. Submit with Space or Enter
  5. Tab through interview: progress bar → back button → question text → textarea → submit → tips toggle
  6. Tab through boolean/scale options with arrow keys (left/right)
  7. Submit answers until interview complete
  8. Tab through finished state: review answers → generate
```

```
Path 2: Summary → Task Graph
  1. Tab through summary: metric cards → phase list → flags → action buttons
  2. Click "View task graph" (Enter)
  3. Tab through task grid: phase headings → task buttons
  4. Open task detail (Enter on a task button)
  5. Tab within detail panel (should cycle, not leave panel)
  6. Press Escape to close
  7. Open "View Prompt" → tab within prompt panel → Escape to close
```

```
Path 3: Mobile navigation
  1. Resize to <768px width
  2. Tab to hamburger menu button, press Enter
  3. Tab through mobile nav links
  4. Activate a link → focus returns to hamburger button
```

### Screen Reader Checks (VoiceOver / NVDA / JAWS)

| Element                  | Expected announcement                                     |
| ------------------------ | --------------------------------------------------------- |
| Stat cards on dashboard  | Description list: "Projects, — " etc.                     |
| Getting-started steps    | Ordered list with 3 items                                 |
| Progress bar             | "Progress" + progressbar with "X of Y questions answered" |
| Phase dots               | Each announced as "{Phase name}: {status}"                |
| Question heading         | `h2` with question text                                   |
| Textarea error           | Role "alert" with error message                           |
| Boolean/scale options    | Radiogroup with question text, arrow-key navigable        |
| Tips toggle              | Button with "expanded/collapsed" state                    |
| Loading skeletons        | "Loading interview" or "Loading blueprint"                |
| Task node button         | "{title} — {status} — {N} dependencies"                   |
| Task detail panel        | "Dialog: Task details: {title}"                           |
| Prompt preview panel     | "Dialog: Execution prompt"                                |
| Close button             | "Close task details" or "Close prompt preview"            |
| Copy prompt confirmation | "Prompt copied to clipboard" (live region)                |
| Interview complete       | Live region: "All questions answered..."                  |
| Answer submitted         | Live region: "Answer saved"                               |
| Error messages           | Role "alert" with error text                              |

### Focus Management Checks

| Transition                  | Expected focus target                              |
| --------------------------- | -------------------------------------------------- |
| Interview loads question    | Question heading (`h2`)                            |
| User submits answer         | New question heading                               |
| User clicks "Back"          | Previous question heading                          |
| Interview completes         | "All questions answered" heading                   |
| Task detail opens           | First focusable in panel (close button or heading) |
| Task detail closes (Escape) | Task node button that opened it                    |
| Prompt preview opens        | Focus trap inside panel                            |
| Prompt preview closes       | Focus returns to trigger                           |
| Mobile menu opens           | First nav link                                     |
| Mobile menu link clicked    | Hamburger toggle button                            |

### Color-Not-Only Checks

| Indicator                           | Text equivalent                          |
| ----------------------------------- | ---------------------------------------- |
| Status dots on task cards           | `sr-only` text: "Ready", "Blocked", etc. |
| Phase dots in progress bar          | `aria-label="{phase}: {status}"`         |
| Status border colors on task cards  | `aria-label` includes status text        |
| Phase summary rows (green/gray)     | Text labels: "No answers" / "X answers"  |
| Metric confidence (green/amber/red) | Percentage text is always present        |
| Needs-review amber border           | `role="alert"` text explains the issue   |

## Known Limitations

- Boolean and scale question types use `sr-only peer` hidden radio inputs with visible labels. Keyboard focus is indicated via `peer-focus-visible:ring-2` on the label. Verified functional but relies on Tailwind v4 `peer` utility.
- No automated accessibility unit tests exist — the web app lacks `@vitejs/plugin-react` and `jsdom` in dev dependencies. Manual validation per the checklist above is required before each release.
- Color contrast ratios use Tailwind defaults which generally meet WCAG AA for the indigo palette. No custom contrast overrides were applied.
