import type { QuestionDefinition } from "./types.js";

export const PHASE_LABELS: Record<string, string> = {
  ideation: "Ideation & Discovery",
  requirements: "Requirements Engineering",
  architecture: "System Architecture",
  security: "Security Planning",
  database: "Database Design",
  backend: "Backend Design",
  frontend: "Frontend Design",
  "core-features": "Core Feature Implementation",
  "ai-systems": "AI / Advanced Systems",
  testing: "Testing & Validation",
  deployment: "Deployment",
  monitoring: "Monitoring & Maintenance",
};

export const PHASE_ORDER: string[] = [
  "ideation",
  "requirements",
  "architecture",
  "security",
  "database",
  "backend",
  "frontend",
  "core-features",
  "ai-systems",
  "testing",
  "deployment",
  "monitoring",
];

export const QUESTIONS: QuestionDefinition[] = [
  // ── Ideation & Discovery ──────────────────────────────────────────
  {
    phaseType: "ideation",
    order: 1,
    text: "What problem does your software solve? Who is the primary audience?",
    type: "text",
    required: true,
    category: "critical",
    validation: { minLength: 20, maxLength: 2000 },
    helpText: "Describe the core problem and target users in 2-3 sentences.",
  },
  {
    phaseType: "ideation",
    order: 2,
    text: "What is the primary platform for your application?",
    type: "select",
    options: [
      "Web (browser-based)",
      "Mobile (iOS/Android)",
      "Desktop (Windows/Mac/Linux)",
      "Cross-platform",
      "API/service only",
      "Not sure yet",
    ],
    required: true,
    category: "high-value",
  },
  {
    phaseType: "ideation",
    order: 3,
    text: "Is this a new product, a rebuild of an existing system, or an addition to an existing product?",
    type: "select",
    options: [
      "New product",
      "Rebuild / migration",
      "Addition to existing product",
      "Proof of concept / prototype",
    ],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "ideation",
    order: 4,
    text: "What is the expected scale of usage at launch?",
    type: "select",
    options: [
      "< 100 users",
      "100 – 1,000 users",
      "1,000 – 10,000 users",
      "10,000 – 100,000 users",
      "100,000+ users",
    ],
    required: true,
    category: "high-value",
  },
  {
    phaseType: "ideation",
    order: 5,
    text: "What are the key differentiators that make this idea worth building?",
    type: "text",
    required: false,
    category: "optional",
    validation: { maxLength: 2000 },
    helpText: "What makes this different from existing solutions?",
  },

  // ── Requirements Engineering ──────────────────────────────────────
  {
    phaseType: "requirements",
    order: 1,
    text: "List the top 3-5 core features your application must have at launch.",
    type: "text",
    required: true,
    category: "critical",
    validation: { minLength: 30, maxLength: 3000 },
    helpText: "Focus on must-have functionality, not nice-to-haves.",
  },
  {
    phaseType: "requirements",
    order: 2,
    text: "Does your application need user accounts and authentication?",
    type: "boolean",
    required: true,
    category: "critical",
  },
  {
    phaseType: "requirements",
    order: 3,
    text: "What authentication methods should be supported?",
    type: "multi_select",
    options: [
      "Email + password",
      "Google / OAuth",
      "GitHub / OAuth",
      "SSO / SAML",
      "Magic link / passwordless",
      "Phone / SMS",
      "Not sure yet",
    ],
    required: true,
    category: "contextual",
    dependsOn: { questionRef: "requirements.2", expectedValue: "true" },
    helpText: "Select all that apply.",
  },
  {
    phaseType: "requirements",
    order: 4,
    text: "Does your application need to support multiple user roles or permission levels?",
    type: "boolean",
    required: true,
    category: "optional",
  },
  {
    phaseType: "requirements",
    order: 5,
    text: "Describe the key user workflows from start to finish.",
    type: "text",
    required: true,
    category: "critical",
    validation: { minLength: 50, maxLength: 4000 },
    helpText: "Walk through what a user does from opening the app to completing their goal.",
  },
  {
    phaseType: "requirements",
    order: 6,
    text: "Are there any critical integrations with external services?",
    type: "text",
    required: false,
    category: "advanced-only",
    validation: { maxLength: 2000 },
    helpText: "List third-party APIs, payment processors, data sources, etc.",
    captureAs: { type: "constraint" },
  },

  // ── System Architecture ───────────────────────────────────────────
  {
    phaseType: "architecture",
    order: 1,
    text: "Do you have preferences or constraints on the tech stack?",
    type: "text",
    required: true,
    category: "critical",
    validation: { minLength: 10, maxLength: 2000 },
    helpText: "Languages, frameworks, databases, cloud providers — anything already decided.",
    captureAs: { type: "constraint" },
  },
  {
    phaseType: "architecture",
    order: 2,
    text: "What is the expected data flow between components?",
    type: "text",
    required: true,
    category: "high-value",
    validation: { minLength: 30, maxLength: 3000 },
    helpText: "Describe how data moves from user input through processing to storage and back.",
  },
  {
    phaseType: "architecture",
    order: 3,
    text: "Will the system need real-time features (websockets, live updates, streaming)?",
    type: "boolean",
    required: true,
    category: "high-value",
  },
  {
    phaseType: "architecture",
    order: 4,
    text: "What is the expected read/write ratio for the primary data operations?",
    type: "select",
    options: ["Read-heavy (80%+ reads)", "Write-heavy (50%+ writes)", "Balanced (~50/50)", "Not sure yet"],
    required: true,
    category: "optional",
  },

  // ── Security Planning ─────────────────────────────────────────────
  {
    phaseType: "security",
    order: 1,
    text: "Does your application handle sensitive personal data (PII, health, financial)?",
    type: "boolean",
    required: true,
    category: "high-value",
  },
  {
    phaseType: "security",
    order: 2,
    text: "What compliance or regulatory standards apply to your project?",
    type: "multi_select",
    options: ["GDPR", "HIPAA", "SOC 2", "PCI-DSS", "CCPA", "None", "Not sure yet"],
    required: true,
    category: "high-value",
    helpText: "Select all that apply.",
    captureAs: { type: "constraint" },
  },
  {
    phaseType: "security",
    order: 3,
    text: "Do you need to encrypt data at rest or in transit beyond standard TLS?",
    type: "boolean",
    required: true,
    category: "contextual",
    dependsOn: { questionRef: "security.1", expectedValue: "true" },
  },
  {
    phaseType: "security",
    order: 4,
    text: "What are your main security concerns for this application?",
    type: "text",
    required: false,
    category: "optional",
    validation: { maxLength: 2000 },
    helpText: "Authentication, authorization, data breaches, API abuse, etc.",
  },

  // ── Database Design ───────────────────────────────────────────────
  {
    phaseType: "database",
    order: 1,
    text: "What type of data will your application store?",
    type: "multi_select",
    options: [
      "Relational data (users, orders, etc.)",
      "Document / JSON data",
      "Time-series data",
      "Graph relationships",
      "File / blob storage",
      "Full-text search",
      "Cache / session data",
    ],
    required: true,
    category: "high-value",
    helpText: "Select all data shapes you expect to work with.",
  },
  {
    phaseType: "database",
    order: 2,
    text: "Do you have an estimated total data volume for the first year?",
    type: "select",
    options: ["< 1 GB", "1 – 10 GB", "10 – 100 GB", "100 GB – 1 TB", "1 TB+", "Not sure yet"],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "database",
    order: 3,
    text: "Are there any specific query patterns or reporting requirements?",
    type: "text",
    required: false,
    category: "advanced-only",
    validation: { maxLength: 2000 },
    helpText: "Aggregations, complex joins, full-text search, analytics queries, etc.",
  },

  // ── Backend Design ────────────────────────────────────────────────
  {
    phaseType: "backend",
    order: 1,
    text: "What backend capabilities does your application require?",
    type: "multi_select",
    options: [
      "REST API",
      "GraphQL API",
      "Background job processing",
      "File upload / processing",
      "Email / notifications",
      "Webhook handling",
      "Real-time / WebSocket",
      "Third-party API integration",
    ],
    required: true,
    category: "high-value",
    helpText: "Select all that apply.",
  },
  {
    phaseType: "backend",
    order: 2,
    text: "Do you need a background job / task queue system?",
    type: "boolean",
    required: true,
    category: "derivable",
  },
  {
    phaseType: "backend",
    order: 3,
    text: "What is the expected API request volume?",
    type: "select",
    options: [
      "< 1K requests/day",
      "1K – 10K requests/day",
      "10K – 100K requests/day",
      "100K – 1M requests/day",
      "1M+ requests/day",
    ],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "backend",
    order: 4,
    text: "Do you need multi-tenancy (isolated data per customer/organization)?",
    type: "boolean",
    required: true,
    category: "optional",
  },

  // ── Frontend Design ───────────────────────────────────────────────
  {
    phaseType: "frontend",
    order: 1,
    text: "What frontend capabilities does your application require?",
    type: "multi_select",
    options: [
      "Standard CRUD UI",
      "Real-time dashboard",
      "Drag-and-drop / interactive",
      "Data visualization / charts",
      "File upload UI",
      "Complex forms / wizards",
      "Mobile-responsive design",
    ],
    required: true,
    category: "high-value",
    helpText: "Select all that apply.",
  },
  {
    phaseType: "frontend",
    order: 2,
    text: "Do you need server-side rendering or static site generation for SEO or performance?",
    type: "boolean",
    required: true,
    category: "derivable",
  },
  {
    phaseType: "frontend",
    order: 3,
    text: "Do you need internationalization (i18n) or accessibility compliance (a11y)?",
    type: "multi_select",
    options: ["Internationalization (i18n)", "Accessibility (a11y / WCAG)", "Both", "Neither"],
    required: true,
    category: "optional",
  },

  // ── Core Feature Implementation ───────────────────────────────────
  {
    phaseType: "core-features",
    order: 1,
    text: "Of the features you listed, which is the most technically complex to implement?",
    type: "text",
    required: true,
    category: "high-value",
    validation: { minLength: 20, maxLength: 2000 },
    helpText: "This will be prioritised in the execution plan.",
  },
  {
    phaseType: "core-features",
    order: 2,
    text: "Are there any features that should be built as independent modules or microservices?",
    type: "text",
    required: false,
    category: "optional",
    validation: { maxLength: 2000 },
    helpText: "Consider separation boundaries, team ownership, or independent deployability.",
  },
  {
    phaseType: "core-features",
    order: 3,
    text: "What are your assumptions about third-party service reliability and availability?",
    type: "text",
    required: false,
    category: "advanced-only",
    validation: { maxLength: 1500 },
    captureAs: { type: "assumption" },
  },

  // ── AI / Advanced Systems ─────────────────────────────────────────
  {
    phaseType: "ai-systems",
    order: 1,
    text: "Does your application use AI or machine learning features?",
    type: "boolean",
    required: true,
    category: "high-value",
  },
  {
    phaseType: "ai-systems",
    order: 2,
    text: "What AI capabilities do you need?",
    type: "multi_select",
    options: [
      "LLM / text generation",
      "Classification / categorization",
      "Recommendation system",
      "Image / media processing",
      "Search / semantic search",
      "Data extraction / parsing",
      "Not sure yet",
    ],
    required: true,
    category: "contextual",
    helpText: "Select all that apply.",
    dependsOn: { questionRef: "ai-systems.1", expectedValue: "true" },
  },
  {
    phaseType: "ai-systems",
    order: 3,
    text: "Do you have an AI model provider preference or existing API keys?",
    type: "select",
    options: [
      "OpenAI",
      "Anthropic",
      "Open-source / self-hosted model",
      "Multiple providers",
      "None decided yet",
    ],
    required: false,
    category: "contextual",
    dependsOn: { questionRef: "ai-systems.1", expectedValue: "true" },
  },

  // ── Testing & Validation ──────────────────────────────────────────
  {
    phaseType: "testing",
    order: 1,
    text: "What level of test coverage do you expect for this project?",
    type: "select",
    options: ["Critical paths only (~30%)", "Core features (~60%)", "Comprehensive (~90%+)", "Not sure yet"],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "testing",
    order: 2,
    text: "Do you need end-to-end or visual regression testing?",
    type: "multi_select",
    options: [
      "Unit tests",
      "Integration tests",
      "End-to-end (E2E) tests",
      "Visual regression tests",
      "API contract tests",
      "Performance / load tests",
    ],
    required: true,
    category: "derivable",
    helpText: "Select all that apply.",
  },
  {
    phaseType: "testing",
    order: 3,
    text: "Do you have specific quality or performance benchmarks the system must meet?",
    type: "text",
    required: false,
    category: "advanced-only",
    validation: { maxLength: 2000 },
    helpText: "Response time SLAs, uptime requirements, error rate thresholds, etc.",
  },

  // ── Deployment ────────────────────────────────────────────────────
  {
    phaseType: "deployment",
    order: 1,
    text: "Where do you plan to host your application?",
    type: "select",
    options: [
      "AWS",
      "Google Cloud",
      "Azure",
      "Railway / Render / Fly.io",
      "Vercel / Netlify",
      "Self-hosted / on-premise",
      "Not sure yet",
    ],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "deployment",
    order: 2,
    text: "Do you need CI/CD pipelines, staging environments, or preview deployments?",
    type: "multi_select",
    options: [
      "CI/CD pipeline",
      "Staging environment",
      "Preview / review apps",
      "Production + DR environment",
      "None",
    ],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "deployment",
    order: 3,
    text: "What is your expected deployment frequency?",
    type: "select",
    options: ["Multiple times per day", "Daily", "Weekly", "Monthly", "Ad-hoc"],
    required: true,
    category: "optional",
  },

  // ── Monitoring & Maintenance ──────────────────────────────────────
  {
    phaseType: "monitoring",
    order: 1,
    text: "What monitoring and observability tools do you plan to use?",
    type: "multi_select",
    options: [
      "Application monitoring (APM)",
      "Infrastructure monitoring",
      "Log aggregation",
      "Error tracking (e.g. Sentry)",
      "Real user monitoring (RUM)",
      "Custom dashboards",
      "None yet",
    ],
    required: true,
    category: "derivable",
    helpText: "Select all that apply.",
  },
  {
    phaseType: "monitoring",
    order: 2,
    text: "Do you have defined SLAs or uptime requirements?",
    type: "select",
    options: [
      "99.9% (8h downtime/year)",
      "99.5% (44h downtime/year)",
      "99% (88h downtime/year)",
      "No formal SLA",
    ],
    required: true,
    category: "derivable",
  },
  {
    phaseType: "monitoring",
    order: 3,
    text: "What are the biggest operational risks you foresee for this application?",
    type: "text",
    required: false,
    category: "advanced-only",
    validation: { maxLength: 2000 },
    captureAs: { type: "risk" },
  },
];

export function getQuestionsByPhase(phaseType: string): QuestionDefinition[] {
  return QUESTIONS.filter((q) => q.phaseType === phaseType).sort((a, b) => a.order - b.order);
}

export function getRequiredQuestions(phaseType: string): QuestionDefinition[] {
  return getQuestionsByPhase(phaseType).filter((q) => q.required);
}

export function countQuestions(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of QUESTIONS) {
    counts[q.phaseType] = (counts[q.phaseType] ?? 0) + 1;
  }
  return counts;
}

export function resolveDependencyRef(ref: string): { phaseType: string; order: number } | null {
  const parts = ref.split(".");
  if (parts.length !== 2) return null;
  const phaseType = parts[0];
  const order = Number(parts[1]);
  if (!phaseType || Number.isNaN(order)) return null;
  return { phaseType, order };
}

export function findQuestionByRef(ref: string): QuestionDefinition | undefined {
  const resolved = resolveDependencyRef(ref);
  if (!resolved) return undefined;
  return QUESTIONS.find((q) => q.phaseType === resolved.phaseType && q.order === resolved.order);
}
