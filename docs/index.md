# Documentation Index

## Getting Started

| Document                              | Audience     | Description                                           |
| ------------------------------------- | ------------ | ----------------------------------------------------- |
| [Development Guide](development.md)   | Contributors | Setup, build, test, environment config                |
| [Contributing Guide](contributing.md) | Contributors | Code organization, versioning rules, testing patterns |
| [Deployment Guide](deployment.md)     | Operators    | CI/CD, secrets, production configuration              |

## Architecture & Design

| Document                                                | Audience     | Description                                                   |
| ------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| [Architecture Overview](architecture.md)                | All          | High-level system design, module boundaries                   |
| [Schema Reference](schema.md)                           | Contributors | Full database schema with all 23 tables                       |
| [UX Specification](ux-spec.md)                          | Designers    | Phase 5 UX audit and improvement plan                         |
| [Accessibility Validation](accessibility-validation.md) | QA           | Keyboard flow, screen reader, and focus management checklists |

## Task Decomposition & Prompting

| Document                                      | Audience     | Description                                            |
| --------------------------------------------- | ------------ | ------------------------------------------------------ |
| [Task Decomposition](task-decomposition.md)   | All          | Phase-to-task mapping, dependency rules, prompt schema |
| [Prompting Standards](prompting-standards.md) | Contributors | Prompt structure, determinism, validation, stability   |
| [Interview Specification](interview-spec.md)  | Contributors | Question flow, state machine, answer normalization     |

## Versioning & Regeneration

| Document                                    | Audience     | Description                                                  |
| ------------------------------------------- | ------------ | ------------------------------------------------------------ |
| [Version Lineage](version-lineage.md)       | Contributors | Versioning model, snapshot semantics, retention policy       |
| [Regeneration Rules](regeneration-rules.md) | All          | Full vs. partial regeneration, escalation table, determinism |

## Operations

| Document                                           | Audience     | Description                                                      |
| -------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| [Runbook](runbook.md)                              | Operators    | Health checks, troubleshooting, incident response                |
| [Logging](logging.md)                              | Operators    | Structured log format, audit events, debugging                   |
| [Observability](observability.md)                  | Operators    | Metrics reference, Prometheus config, alerting rules, dashboards |
| [Grafana Dashboard](grafana-dashboard.json)        | Operators    | Importable dashboard JSON (8 panels)                             |
| [Performance Optimizations](perf-optimizations.md) | Contributors | Store indexing, Map lookups, pagination, lazy prompt assembly    |

## User Guide

| Document                    | Audience | Description                                                              |
| --------------------------- | -------- | ------------------------------------------------------------------------ |
| [User Guide](user-guide.md) | Users    | Version history, comparison, exports, activity timeline, self-host notes |

## Known Limitations & Phase Summaries

| Document                                     | Description                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [Phase 7 Completion](phase7-completion.md)   | Guardrails, performance, observability — verification results, residual risks |
| [Phase 6 Completion](phase6-completion.md)   | Versioning, export, diff, analytics — delivered and deferred                  |
| [Phase 4 Limitations](phase4-limitations.md) | Known issues from task graph and prompt generation hardening                  |

## Architecture Decisions

| Document                                                            | Description                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| [ADR-001](decisions/001-project-initialization.md)                  | Project initialization and monorepo setup              |
| [ADR-006](decisions/006-quality-toolchain.md)                       | Quality toolchain: TypeScript strictness, lint, format |
| [ADR-008](decisions/008-planning-engine-data-model.md)              | Planning engine data model and decomposition rules     |
| [ADR-009](decisions/009-provider-credentials-and-secret-storage.md) | Provider credential encryption and storage             |
