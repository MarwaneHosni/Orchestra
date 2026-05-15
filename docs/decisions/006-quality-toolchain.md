# Decision 006: Quality Toolchain

**Date:** 2026-05-15

## Context

Phase 6 required establishing the project's quality gates so changes are consistently formatted, validated, and tested before reaching the codebase.

## Decisions

### Linting

- **ESLint 10** with flat config (`eslint.config.js`).
- **typescript-eslint** for TypeScript-specific rules.
- `no-unused-vars` is enabled with `argsIgnorePattern: "^_"` to support the `_request` convention in Fastify route handlers.
- `.d.ts` files, build output, and `drizzle/` migrations are excluded from linting.

### Formatting

- **Prettier 3** with project-wide `.prettierrc` and `.prettierignore`.
- Trailing commas, single quotes disabled (double quotes), 110 print width.
- Applied automatically on commit via `lint-staged`; checked in CI via `pnpm format`.

### Testing

- **Vitest 4** with workspace mode (`vitest.workspace.ts` discovers all packages).
- Tests are co-located with source files as `*.test.ts`.
- Test baseline:
  - `packages/shared`: `notEmpty` utility (5 tests)
  - `apps/api`: `AppError`/`NotFoundError`/`ValidationError` classes (5 tests)
  - `apps/api`: `paginatedResponse` and `paginationSchema` (5 tests)
- No test environment required (jsdom, etc.) — all tests are pure logic.

### Pre-commit Hooks

- **Husky 9** manages git hooks.
- **lint-staged** runs ESLint `--fix` and Prettier `--write` on staged `*.ts`/`*.tsx` files, and Prettier on `*.json`/`*.yaml`/`*.md` files.
- Commit is blocked if any check fails.
- `git commit --no-verify` available for emergencies.

### Commit Messages

- No automated enforcement (no commitlint). Developers are encouraged to use descriptive messages prefixed by area, e.g. `api: add project validation` or `web: fix nav spacing`.

## Frozen Assumptions

- ESLint is configured at the project root only. Individual packages do not have their own ESLint configs.
- Vitest workspace config automatically discovers packages via `packages/*` and `apps/*` patterns.
- The `format` script runs Prettier in check mode (non-destructive). `format:fix` applies changes.
- The Next.js ESLint plugin is not configured. The `next build` shows a non-blocking warning about this, which will be resolved when the frontend is more mature.

## Status

Accepted.
