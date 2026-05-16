# User Guide

## Overview

Orchestra transforms a raw software idea into a structured, versioned development plan. This guide explains how to use the versioning, comparison, export, and activity tracking features.

---

## Version History

Every significant event in a project creates a **snapshot** — a frozen point-in-time record that captures the project state.

### Accessing Version History

Navigate to a project and click **Exports & versions** in the summary page, or click **Version history** in the task graph toolbar. The version history page shows:

- A **timeline** of all snapshots, ordered by version number.
- Each entry shows: version number, reason (e.g., "Interview completed", "Plan regenerated"), date, plan version, and answer count.
- The latest snapshot is automatically selected on page load.

### Snapshot States

| Badge     | Meaning                                         |
| --------- | ----------------------------------------------- |
| `Initial` | First snapshot — project creation               |
| `Partial` | Partial regeneration — only some phases changed |
| `Failed`  | Snapshot creation failed — see error message    |

Snapshots with partial regeneration have an amber background and show the affected phases.

### Version Labels

Each snapshot carries a human-readable reason:

| Reason label           | Trigger                               |
| ---------------------- | ------------------------------------- |
| Project created        | Initial project setup                 |
| Interview completed    | All interview questions answered      |
| Plan regenerated       | Plan re-generated from edited answers |
| Answers edited         | Individual answers modified           |
| Task graph regenerated | Task graph re-decomposed              |
| Manual snapshot        | Explicit user-triggered snapshot      |

---

## Comparing Versions

Select two snapshots in the version timeline to compare them.

### How to compare

1. Click the first snapshot (it becomes highlighted with a ring).
2. Click the second snapshot — the comparison panel opens on the right.
3. The later version is always on the right side of the comparison.

### What the comparison shows

| Section               | Content                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| **Header**            | Left/right version numbers, regeneration scope badge (Full/Partial/No changes), reasons, and date |
| **Summary cards**     | Count of changed tasks, prompts, blueprint items, and phases                                      |
| **Scope explanation** | Whether this was a full or partial regeneration, and which phases were affected                   |
| **Task changes**      | List of added, removed, or modified tasks with status transitions                                 |
| **Blueprint changes** | Added/removed assumptions, constraints, risks, and modified phase summaries                       |

---

## Exporting Artifacts

### From Version History

1. Click a snapshot in the timeline to select it.
2. The **Export** panel appears on the right.
3. Choose **Markdown** or **JSON** format.
4. Click **Export** on the desired artifact type:

| Artifact        | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| **Blueprint**   | Plan version, phase statuses, assumptions, constraints, risks  |
| **Task Graph**  | All tasks grouped by phase with status, type, and dependencies |
| **AI Prompts**  | All execution prompts in task execution order                  |
| **Full Bundle** | Combined blueprint + task graph + prompts in a single document |

### From Task Graph

The task graph page has an **Export bundle** button that exports the prompt bundle directly.

### Download and Re-download

- Each new export automatically triggers a file download.
- Previously exported artifacts appear in the **All exports for this snapshot** list.
- Click **Download** to re-download without regenerating content.
- Click **Copy** to copy the full export content to the clipboard.

### File Naming

```
orchestra-v{version}-{type}.{ext}
```

Examples:

- `orchestra-v3-blueprint.md`
- `orchestra-v3-full_bundle.json`

---

## Activity Timeline

The activity timeline shows key lifecycle events in chronological order (newest first).

### Accessing

On the version history page, expand the **Activity timeline** section.

### Events Shown

| Event                      | Description                                |
| -------------------------- | ------------------------------------------ |
| Snapshot created           | Full project snapshot taken                |
| Partial regeneration       | Phase-specific regeneration                |
| Snapshot failed            | Snapshot creation failed                   |
| Artifact exported          | Blueprint, task graph, or prompts exported |
| Prior export re-downloaded | Previously generated export retrieved      |

### What's NOT in the timeline

The timeline focuses on meaningful lifecycle events. It does not show:

- Individual page views
- Mouse clicks or hover events
- Form field interactions
- API request timing

---

## Usage Summary

The **Usage summary** section (expandable on the version history page) shows aggregate metrics:

| Metric          | Description                                                |
| --------------- | ---------------------------------------------------------- |
| **Snapshots**   | Total number of snapshots (with partial count in subtitle) |
| **Exports**     | Total number of exports generated                          |
| **Comparisons** | Number of version comparisons performed                    |
| **Failed**      | Number of failed snapshot attempts (shown in red when > 0) |

---

## Self-Host Notes

### Environment Variables

Versioning and export features require no additional environment variables beyond what the base application needs (`DATABASE_URL`).

### Storage

All versioning and export data uses the same PostgreSQL database as the rest of the application. No external storage services (S3, etc.) are required. Export content is stored as text in the `export_store` (in-memory for now, persisted to the database via the existing Drizzle schema).

### BYOK (Bring Your Own Key)

Versioning and export operations do not depend on any AI provider keys. They work entirely from stored data:

- Snapshot creation uses task graph and prompt stores — no AI calls.
- Export generation reads from snapshot records — no AI calls.
- Analytics events are local — no external service.

AI provider keys are only needed for:

- Interview question generation (not yet implemented)
- Prompt execution against AI models (future feature)
