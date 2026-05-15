import { createInMemoryStore, replaceStore } from "../lib/orchestration/store.js";
import { OrchestrationService } from "../lib/orchestration/orchestration.service.js";
import { QUESTIONS } from "../lib/interview/questions.js";

const LOG_PREFIX = "[demo-seed]";

/**
 * Seeds a demo project with pre-populated answers so the full interview flow
 * can be exercised without manual data entry.
 *
 * Replaces the global in-memory store so the running API server serves the
 * seeded data immediately.
 */
export function seedDemoData() {
  const store = createInMemoryStore();
  const orch = new OrchestrationService(store);

  const { projectId, sessionId } = orch.createProject({
    ideaText:
      "A real-time collaborative task management platform for distributed engineering teams. " +
      "Integrates with GitHub, Slack, and Jira. Includes sprint planning, kanban boards, " +
      "and automated standup reports.",
    projectName: "TeamSync",
  });

  console.log(`${LOG_PREFIX} created project=${projectId} session=${sessionId}`);

  orch.startSession(sessionId);

  const answers: Record<string, string> = {
    "ideation.1":
      "Distributed engineering teams need a unified view of tasks across GitHub, Jira, and Slack. The primary audience is software teams of 5-50 people.",
    "ideation.2": "Web (browser-based)",
    "ideation.3": "New product",
    "ideation.4": "1,000 – 10,000 users",
    "ideation.5":
      "Deep bi-directional sync with dev tools, automated standup summaries, and AI-powered sprint insights.",
    "requirements.1":
      "GitHub/Jira integration with automatic task sync, interactive kanban boards, sprint planning with velocity tracking, automated standup reports, team workload visualization.",
    "requirements.2": "true",
    "requirements.3": "Email + password,Google / OAuth,GitHub / OAuth,SSO / SAML",
    "requirements.4": "true",
    "requirements.5":
      "User logs in, sees their team dashboard with active sprint. They can drag tasks between columns, view GitHub PR status inline, and join daily standup via a modal that posts to Slack.",
    "requirements.6":
      "GitHub API for PR/issue sync, Slack API for notifications and standups, Jira REST API for task import, SendGrid for email notifications.",
    "architecture.1":
      "Node.js backend with React frontend, PostgreSQL for primary data, Redis for caching and real-time pub/sub, hosted on AWS ECS.",
    "architecture.2":
      "User actions flow from React through REST API to PostgreSQL. WebSocket connections handle real-time board updates. GitHub webhooks push PR status changes into the system.",
    "architecture.3": "true",
    "architecture.4": "Read-heavy (80%+ reads)",
    "security.1": "true",
    "security.2": "GDPR,SOC 2",
    "security.3": "true",
    "security.4":
      "OAuth token storage for third-party API access, team-level data isolation, API rate limiting.",
    "database.1": "Relational data (users, orders, etc.),Cache / session data",
    "database.2": "10 – 100 GB",
    "database.3": "Aggregate sprint velocity per team over time, full-text search across tasks and comments.",
    "backend.1":
      "REST API,Background job processing,Webhook handling,Real-time / WebSocket,Third-party API integration",
    "backend.2": "true",
    "backend.3": "10K – 100K requests/day",
    "backend.4": "true",
    "frontend.1":
      "Standard CRUD UI,Real-time dashboard,Drag-and-drop / interactive,Data visualization / charts",
    "frontend.2": "true",
    "frontend.3": "Internationalization (i18n),Accessibility (a11y / WCAG)",
    "core-features.1":
      "The bi-directional GitHub/Jira sync is the most complex feature due to webhook handling, conflict resolution, and rate limit management.",
    "core-features.2": "The webhook ingestion service could be extracted as a standalone module.",
    "core-features.3":
      "Third-party APIs (GitHub, Slack, Jira) will have >99.9% uptime and will not introduce breaking changes during the development window.",
    "ai-systems.1": "true",
    "ai-systems.2": "LLM / text generation",
    "ai-systems.3": "Multiple providers",
    "testing.1": "Core features (~60%)",
    "testing.2": "Unit tests,Integration tests,End-to-end (E2E) tests",
    "testing.3": "API response time under 200ms for P95, 99.5% uptime SLA.",
    "deployment.1": "AWS",
    "deployment.2": "CI/CD pipeline,Staging environment,Preview / review apps",
    "deployment.3": "Multiple times per day",
    "monitoring.1": "Application monitoring (APM),Log aggregation,Error tracking (e.g. Sentry)",
    "monitoring.2": "99.9% (8h downtime/year)",
    "monitoring.3":
      "Third-party API rate limits during peak usage, WebSocket connection limits at scale, Data consistency during webhook replay.",
  };

  for (const q of QUESTIONS) {
    const ref = `${q.phaseType}.${q.order}`;
    const value = answers[ref];
    if (value) {
      orch.submitAnswer(sessionId, ref, value, "high");
    }
  }

  console.log(`${LOG_PREFIX} answered ${Object.keys(answers).length} questions`);

  const allDone = QUESTIONS.filter((q) => {
    const ref = `${q.phaseType}.${q.order}`;
    return !!answers[ref];
  });
  console.log(`${LOG_PREFIX} ${allDone.length}/${QUESTIONS.length} questions answered`);

  // Replace the global store so the running API server serves seeded data
  replaceStore(store);

  return { projectId, sessionId, store, answers };
}

// Allow running directly
const isMain = process.argv[1]?.endsWith("demo-seed.ts") || process.argv[1]?.endsWith("demo-seed.js");
if (isMain) {
  const { projectId, sessionId } = seedDemoData();
  console.log(`\nDemo project ready:`);
  console.log(`  Project ID: ${projectId}`);
  console.log(`  Session ID: ${sessionId}`);
  console.log(`\nStart the API and visit:`);
  console.log(`  http://localhost:3000/api/v1/interviews/${sessionId}/next`);
  console.log(`  http://localhost:3001/projects/${sessionId}/summary`);
}
