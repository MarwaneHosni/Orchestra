# Decision 003: Frontend Application Shell

**Date:** 2026-05-15

## Context

Phase 3 required building the initial user-facing shell — layout, navigation, routing skeleton, and placeholder states — to establish the frontend foundation before any business features are implemented.

## Decisions

### Framework

- **Next.js 15** with App Router. Chosen for its mature server-component model, file-based routing, and broad ecosystem support.
- The App Router provides built-in support for `loading.tsx`, `error.tsx`, and `not-found.tsx` boundary files, which map directly to the required loading/empty/error states.

### Styling

- **Tailwind CSS v4** — CSS-based configuration (no `tailwind.config.ts`). Theme tokens are defined in `globals.css` via the `@theme` directive.
- Custom `orchestra-*` color palette (indigo range) used as the primary accent.
- Semantic token aliases (`--color-surface`, `--color-border`, `--color-text-primary`, etc.) for consistency.

### Component Architecture

- **Server Components by default** in Next.js App Router. Interactive pages (forms, settings) are marked `"use client"`.
- Reusable UI primitives in `components/ui/` — Button, Card, Input, Skeleton, EmptyState, ErrorState.
- Accessible form wrapper (`components/forms/form-field.tsx`) that provides `aria-*` wiring automatically.
- Layout components in `components/layout/` — Navbar with responsive mobile hamburger menu.

### Routing Structure

| Route           | Page                       | States             |
| --------------- | -------------------------- | ------------------ |
| `/`             | Dashboard                  | loading, error     |
| `/projects`     | Project list               | loading, error     |
| `/projects/new` | New project form           | (client component) |
| `/blueprints`   | Blueprint list             | loading, error     |
| `/plans`        | Plan list                  | loading, error     |
| `/settings`     | Settings (API keys, prefs) | loading, error     |
| `/*`            | 404 not-found              | —                  |

### Port Allocation

- Frontend runs on **port 3001** to avoid conflict with the API (port 3000). Configured via `next dev --port 3001` and documented in `.env.example` as `WEB_PORT`.

### Accessibility

- All interactive elements use semantic HTML (`button`, `nav`, `form`, `label`).
- `aria-current="page"` on active nav links.
- `aria-invalid` and `aria-describedby` on form fields via the `FormField` wrapper.
- `role="alert"` on error states.
- Focus-visible ring styles on all interactive elements.

## Frozen Assumptions

- The frontend is a separate process from the API. Communication will happen over HTTP once the API is implemented.
- No authentication or session management is implemented. The shell assumes a local-only developer experience.
- All pages are statically prerendered (no `getServerSideProps` or `generateStaticParams` yet). Dynamic routes will be added when real data is available.
- No component library (shadcn/ui, MUI, etc.) is used — only hand-written components for maximum control.

## Status

Accepted.
