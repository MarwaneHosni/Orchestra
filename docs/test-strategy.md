# Test Strategy

## 1. Test Layer Definitions

### 1.1 Layer Map

| Layer           | Tools                      | Scope                                          | Speed    | Runs in CI       |
| --------------- | -------------------------- | ---------------------------------------------- | -------- | ---------------- |
| **Unit**        | Vitest                     | Single function, class, or module in isolation | ~ms      | ✅ Always        |
| **Integration** | Vitest + in-memory stores  | Service wired to its stores, no network        | ~ms–10ms | ✅ Always        |
| **Snapshot**    | Vitest (`toMatchSnapshot`) | Structural output stability (graph, prompt)    | ~ms      | ✅ Always        |
| **Contract**    | TypeScript + Zod           | Schema validation, type assertions             | ~ms      | ✅ Via typecheck |
| **End-to-end**  | Vitest + chained services  | Multi-step product flow via in-memory stores   | ~10–50ms | ✅ Always        |

### 1.2 What Each Layer Covers

| Layer           | Responsible for                                                                                                                                                     | NOT responsible for                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Unit**        | Input validation, edge cases, error paths, pure computation (e.g., `generateTasks`, `validatePrompt`, `computeDependencies`)                                        | Store interactions, cross-module wiring, HTTP serialization     |
| **Integration** | Store behavior (save/retrieve/list/update), service+store wiring, multi-step flows (e.g., regenerate → snapshot → prompts), error recovery across module boundaries | HTTP status codes, request parsing, network errors              |
| **Snapshot**    | Determinism of generated outputs (graph structure, prompt text). Catches accidental shape changes.                                                                  | Non-deterministic fields (UUIDs, timestamps), logic correctness |
| **Contract**    | API request/response shapes (`ExecutionTaskSchema`, `BlueprintOutputSchema`, `projectSnapshotSchema`), DB column types vs. app types                                | Business logic, runtime behavior                                |
| **End-to-end**  | Full product flows: create project → interview → blueprint → task graph → prompts → export → snapshot → compare                                                     | Every possible error path, UI rendering, network failures       |

### 1.3 Existing Coverage Count

| Layer       | Test files                                                | Approximate tests |
| ----------- | --------------------------------------------------------- | ----------------- |
| Unit        | 6 (errors, schemas, encryption, provider, router, shared) | ~46               |
| Integration | 5 (orchestration, blueprint, versioning, diff, export)    | ~75               |
| Snapshot    | 1 (generator.test.ts — 3 snapshots)                       | ~4                |
| Contract    | 2 (Zod schemas, typecheck)                                | ~10               |
| End-to-end  | 2 (byok-e2e, accounting)                                  | ~24               |
| **Total**   | 17 test files                                             | ~238 `it()` calls |

---

## 2. Coverage Map by Feature

### 2.1 Critical User Flows

| Flow                                                       | Unit | Integration | Snapshot | E2E | Contract | Priority |
| ---------------------------------------------------------- | ---- | ----------- | -------- | --- | -------- | -------- |
| Interview question sequencing                              | ✅   | ✅          | —        | ✅  | ✅       | P0       |
| Answer submission + editing                                | ✅   | ✅          | —        | ✅  | ✅       | P0       |
| Blueprint generation from answers                          | ✅   | ✅          | —        | ✅  | ✅       | P0       |
| Phase status computation (sufficient/insufficient/missing) | ✅   | ✅          | —        | —   | —        | P0       |
| Task graph generation from phases                          | ✅   | ✅          | ✅       | ✅  | ✅       | P0       |
| Task dependency computation                                | ✅   | —           | ✅       | —   | —        | P0       |
| Task status computation (ready/blocked)                    | ✅   | —           | ✅       | —   | —        | P0       |
| Prompt assembly + formatting                               | ✅   | ✅          | ✅       | ✅  | —        | P0       |
| Prompt validation (failed/needs_review)                    | ✅   | ✅          | —        | —   | —        | P1       |
| Phase input validation                                     | ✅   | —           | —        | —   | —        | P1       |
| Snapshot creation + versioning                             | —    | ✅          | —        | ✅  | ✅       | P0       |
| Full vs. partial regeneration scope                        | ✅   | ✅          | —        | ✅  | —        | P0       |
| Partial regeneration (affected tasks/prompts only)         | —    | ✅          | —        | —   | —        | P0       |
| Error recovery (failed snapshot on throw)                  | —    | ✅          | —        | —   | —        | P1       |
| Version diff (tasks, prompts, blueprint)                   | —    | ✅          | ✅       | —   | —        | P0       |
| Export generation (all 4 types × 2 formats)                | —    | ✅          | ✅       | —   | ✅       | P0       |
| Export store persistence                                   | —    | ✅          | —        | —   | —        | P1       |
| Analytics event emission                                   | —    | ✅          | —        | —   | —        | P2       |
| Provider credential CRUD                                   | —    | ✅          | —        | —   | ✅       | P0       |
| Provider routing fallback                                  | ✅   | ✅          | —        | —   | —        | P0       |
| Budget enforcement + rate limiting                         | ✅   | ✅          | —        | —   | —        | P0       |
| Encryption/decryption                                      | ✅   | —           | —        | —   | —        | P0       |

### 2.2 Coverage Gaps (Highest Priority to Fill)

| Gap                                                    | Flows affected                     | Why it matters                                  | Target layer                                                |
| ------------------------------------------------------ | ---------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| No snapshot tests for export JSON structure            | Export generation                  | Export format could change without detection    | Snapshot (add `toMatchSnapshot` for JSON output)            |
| No E2E test for regeneration → compare → export flow   | Version diff, Export, Regeneration | Full product workflow not validated as a chain  | E2E (chain versioning + diff + export services)             |
| No contract tests for provider request/response shapes | Provider routing, BYOK             | External API changes are caught only at runtime | Contract (define expected request/response types)           |
| No integration tests for analytics emission points     | Analytics event emission           | Events could silently stop being emitted        | Integration (verify `logAudit` called with correct payload) |

### 2.3 Highest-Risk Regressions

| Risk                                                             | Why it's high-risk                                                           | Detection layer                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema drift** — DB column and app type get out of sync        | New migration changes a column; app code still uses old type                 | Contract (typecheck), Integration (store save/retrieve)                                                                                                                                                                                |
| **Prompt shape drift** — prompt text format changes accidentally | `formatPrompt()` changes output; downstream exports and comparisons break    | Snapshot (formatPrompt, section content)                                                                                                                                                                                               |
| **Provider adapter breakage** — OpenAI/Anthropic API changes     | External API changes cause adapter failures that aren't caught until runtime | Unit (request shape construction, response parsing with known payloads); Contract (request/response type definitions); **No runtime contract verification exists** — a future integration suite should validate against the actual API |
| **Export format changes** — JSON or Markdown structure changes   | Downstream consumers expect a specific schema                                | Snapshot (export content determinism), Contract (Zod)                                                                                                                                                                                  |
| **Regeneration bugs** — wrong scope, wrong affected tasks        | Escalation rules change; partial regen produces wrong results                | Integration (regenerate → verify affected tasks)                                                                                                                                                                                       |
| **Security regression** — encryption, credential redaction       | Key material leaks or redaction filters fail                                 | Unit (encryption round-trip, redaction patterns)                                                                                                                                                                                       |

---

## 3. CI Quality Gate Rules

### 3.1 Current Gates (already enforced)

| Gate                 | When            | Command          | Failure behavior                         |
| -------------------- | --------------- | ---------------- | ---------------------------------------- |
| ESLint               | Pre-commit + CI | `pnpm lint`      | Blocks commit (pre-commit), marks CI red |
| Prettier             | Pre-commit + CI | `pnpm format`    | Blocks commit (pre-commit), marks CI red |
| TypeScript typecheck | CI              | `pnpm typecheck` | Marks CI red                             |
| Vitest tests         | CI              | `pnpm test`      | Marks CI red                             |
| Build                | CI              | `pnpm build`     | Marks CI red                             |

### 3.2 Proposed Additional Gates

| Gate                            | When                 | Command              | Threshold                       | Failure behavior             |
| ------------------------------- | -------------------- | -------------------- | ------------------------------- | ---------------------------- |
| Snapshot review                 | Code review (manual) | `pnpm test --update` | No un-reviewed snapshot changes | PR blocked by reviewer       |
| Pre-commit typecheck (optional) | Pre-commit           | Not currently run    | —                               | Recommended but not required |
| No skipped tests                | CI                   | `pnpm test`          | Zero `.skip` or `.todo`         | Marks CI yellow (warning)    |

### 3.3 CI Pipeline Order (enforced)

```
1. lint          (fastest failure — catches style/syntax issues)
2. format        (fastest failure — catches formatting drift)
3. typecheck     (moderate — catches type errors before test execution)
4. test          (slowest — runs all test layers)
5. build         (guarantees deployable artifacts)
```

---

## 4. Test Conventions

### 4.1 Naming

```
describe("ModuleName - feature area")       // e.g., "VersioningService - regeneration"
  it("does something specific when condition")  // plain English, present tense
```

Rules:

- `describe` names start with the module or service name followed by a hyphen and the feature area
- `it` names describe the expected behavior from the user/caller perspective
- Avoid "should" — use present tense: "rejects invalid input" not "should reject invalid input"
- Group edge cases and error paths under a separate `describe` block or a consistent naming suffix

### 4.2 File Organization

```
src/
  lib/
    module/
      *.ts             — source code
      *.test.ts        — co-located tests
```

- Test files are co-located with source files, not in a separate `__tests__` directory (existing convention).
- Each test file corresponds to one source module. If the source has multiple exports, test all exports in the same file.
- Integration tests that span multiple modules go in the primary module's test file (e.g., versioning tests cover versioning+graph+prompt together).

### 4.3 Fixture Strategy

| Data type          | Strategy                                                           | Example                                                         |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Simple primitives  | Inline in test or helper function                                  | `makePhase()`, `makeTask()`                                     |
| Service state      | `setupEnv()` factory returning stores + service                    | `createService()` in versioning tests                           |
| Multiple scenarios | Parameterized via `for...of` or `each`                             | `for (const status of ["insufficient", "missing"])`             |
| Shared fixtures    | Module-level `const` or factory function (NO shared mutable state) | `const PLAN_ID = "plan-test"`, `const PROJECT_ID = "proj-test"` |

Rules:

- Each test creates its own data via factory functions — never share mutable state between tests
- Use JSDoc or comments only when the fixture purpose is non-obvious
- Avoid JSON fixture files; keep test data in code for readability and type safety

### 4.4 Mocking Rules

| Scenario              | Approach                                                                                                                | Why                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| AI provider calls     | **Do not mock.** Write unit tests with known inputs and validate the output shape, not the network behavior.            | Provider adapters are thin wrappers; network-level tests belong in a separate integration suite (future). |
| Time-dependent logic  | Use deterministic timestamps (`new Date("2026-01-01T00:00:00Z")`) rather than `vi.useFakeTimers()`                      | Simpler, more readable, avoids timer flakiness                                                            |
| `crypto.randomUUID()` | **Do not stub.** Tests assert structural equality (not ID equality) or use snapshot exclusion patterns.                 | UUIDs are non-deterministic by design; tests should not depend on specific UUID values.                   |
| Store dependencies    | Use real in-memory implementations (`createInMemoryXStore()`).                                                          | These are lightweight, correct, and exercise the same contract as a production store.                     |
| External HTTP calls   | **Do not make real HTTP calls in unit/integration tests.** Services that require HTTP should accept an injected client. | Keeps tests fast and deterministic.                                                                       |

**E2E test pattern** (template in `byok-e2e.test.ts`): Chain multiple services together using their in-memory stores. Arrange → Act → Assert across module boundaries. Test a complete product flow (e.g., create project → interview → blueprint → task graph → prompts) without HTTP or real I/O. Use `setupEnv()` or `createService()` factories to isolate each test run.

```
Example flow from byok-e2e.test.ts:
  createInMemoryStore()                    ← arrange all stores
  new OrchestrationService(store)          ← arrange services
  service.createProject(input)             ← act
  service.startSession(sessionId)
  service.submitAnswer(sessionId, ...)
  generator.generate(project, session, ...) ← cross-module
  expect(output.phases.length).toBe(12)    ← assert
```

---

## 5. Test Plan for Phase 7

### 5.1 Priority Order

| Priority | Area                                                      | Test type       | Existing coverage | Work needed                                                            | Definition of Done                                                                                                                          |
| -------- | --------------------------------------------------------- | --------------- | ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Interview question sequencing + dependency rules          | Integration     | 1 file, 15 tests  | Verify coverage of all 12 phases, dependency rules, skip logic         | `getNextQuestion` tested with all 12 phases; dependency gating tested; skip path tested                                                     |
| P0       | Blueprint generation edge cases                           | Integration     | 1 file, 20 tests  | Add tests for all ambiguity flag types, confidence boundaries          | All 5 flag types (`missing`, `too_short`, `low_confidence`, `vague`, `conflicting`) have a test; low/medium/high confidence boundary tested |
| P0       | Task graph for all phase status combinations              | Unit + Snapshot | 1 file, 26 tests  | Add coverage for all 3 statuses × 12 phases                            | Every `PhaseInput.status` (`sufficient`, `insufficient`, `missing`) tested for at least one phase; snapshot updated for new graph shape     |
| P0       | Prompt validation integration (failed/needs_review)       | Integration     | 1 file, 16 tests  | Verify `assemblePrompt` correctly sets status for each validation path | Test exists for `assemblePrompt` producing each status (`complete`, `failed`, `needs_review`) naturally                                     |
| P1       | Export determinism across all formats                     | Snapshot        | 1 file, 18 tests  | Add snapshot for JSON export output structure                          | JSON export `toMatchSnapshot()` added; repeated runs produce identical output                                                               |
| P1       | Version diff with real blueprint content                  | Integration     | 1 file, 18 tests  | Add blueprint content to diff tests                                    | At least one diff test passes structured `BlueprintContent` and validates assumptions/constraints/risks diffs                               |
| P1       | Error recovery for all service failure modes              | Integration     | Scattered         | Create dedicated error-recovery describe blocks                        | Each service's `describe("error handling")` block tests at least 2 failure paths                                                            |
| P2       | Analytics emission points                                 | Integration     | None              | Verify events are emitted with correct payloads                        |
| P2       | Provider adapter edge cases (timeout, malformed response) | Unit            | 1 file, 11 tests  | Add tests for non-200 responses, incomplete payloads                   |

### 5.2 Write Order (per-module)

For each module, write tests in this order:

1. **Happy path** — the primary use case works (e.g., "generates a complete task graph from 12 phases")
2. **Edge cases** — empty, missing, extreme values (e.g., "handles empty acceptance criteria")
3. **Error paths** — invalid input throws or returns failure (e.g., "rejects duplicate phase types")
4. **Determinism** — same inputs produce identical outputs (e.g., "prompt text is deterministic")
5. **Store behavior** — data can be saved, retrieved, listed (e.g., "saves and retrieves a graph version")

---

## 6. Test Tooling Roadmap

| Tool                   | Current state            | Recommended                                                                                   | When                              |
| ---------------------- | ------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------- |
| Coverage reporting     | None                     | Add `@vitest/coverage-v8` to workspace root; set minimum 70% threshold per package            | Phase 7                           |
| Shared test utilities  | None                     | Create `apps/api/src/test-utils.ts` with shared `makePhase`, `makeTask`, mock store factories | Phase 7                           |
| Pre-commit test runner | Tests not run pre-commit | Add `vitest related --run` for changed files                                                  | Phase 7 (optional, watch CI time) |
| Web UI tests           | None                     | Add `@testing-library/react` + `jsdom` for component tests                                    | Phase 8                           |
| E2E with real DB       | None                     | Add Docker-based integration test with testcontainers or similar                              | Phase 9                           |

---

## 7. Summary

- **17 test files**, ~238 tests today
- **5 test layers**: Unit, Integration, Snapshot, Contract, E2E
- **P0 regressions**: schema drift, prompt shape drift, export format changes, regeneration bugs
- **CI gates**: lint → format → typecheck → test → build (existing)
- **Key conventions**: co-located tests, factory fixtures, in-memory stores, no mocking library
- **Next priorities**: expand edge case coverage for task graph/prompt/blueprint, add coverage for export determinism, add analytics emission tests
