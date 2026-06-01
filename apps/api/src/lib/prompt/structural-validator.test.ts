import { describe, expect, it } from "vitest";
import { validateExecutionPrompt, extractSectionContent } from "./structural-validator.js";
import { parseMarkdownSections, matchSectionId } from "./markdown-parser.js";
import { EXECUTION_PROMPT_SECTIONS } from "./schema.js";

function validPrompt(): string {
  return [
    "## Objective",
    "Build a complete user authentication system with JWT tokens. This includes secure login, registration, password reset, and token refresh functionality. Must support role-based access control for admin and regular user roles.",
    "",
    "## Context",
    "This project is a production-grade web application that needs secure user login and session management. The application serves thousands of concurrent users across multiple geographic regions. Security is critical as the system handles personally identifiable information (PII) and financial data. The frontend is built with React and communicates with the backend via REST APIs. All authentication flows must comply with OWASP security guidelines and GDPR data protection requirements.",
    "",
    "## Constraints",
    "- Must use bcrypt for password hashing",
    "- Tokens must expire after 24 hours",
    "",
    "## Expected Output",
    "A complete authentication module with login, register, and token refresh endpoints. Includes middleware for route protection and user role verification. Must include comprehensive unit and integration test coverage.",
    "",
    "## Validation Criteria",
    "- Passwords are hashed before storage",
    "- Tokens include user ID and expiration",
    "",
    "## Architectural Alignment",
    "This authentication module integrates into the existing Express.js middleware pipeline. It connects with the PostgreSQL user database and Redis session store. All endpoints follow the established API versioning and error handling patterns used across the codebase.",
    "",
    "## Agent Tips",
    "### Security",
    "- Never log passwords",
    "- Use HTTPS for all auth endpoints",
    "### Edge Cases",
    "- Handle expired tokens gracefully",
    "### Dependency Warnings",
    "- Check bcrypt version compatibility",
    "### Common Bugs",
    "- Off-by-one in token expiration logic",
  ].join("\n");
}

function validPromptWithPreamble(): string {
  return [
    "This is some reasoning text before the structured sections.",
    "",
    "## Objective",
    "Build a comprehensive feature for managing user subscriptions with automated billing and invoice generation. This forms the core monetization engine of the platform.",
    "",
    "## Context",
    "This project needs a subscription management system built correctly. It handles tiered pricing plans, automatic monthly billing, invoice generation, and payment gateway integration with Stripe. The system must support upgrades, downgrades, cancellations, and prorated refunds.",
    "",
    "## Constraints",
    "- One constraint",
    "",
    "## Expected Output",
    "A complete implementation of the subscription management feature with billing integration, invoice PDF generation, and admin dashboard for managing customer subscriptions and payment history.",
    "",
    "## Validation Criteria",
    "- Criteria one",
    "",
    "## Architectural Alignment",
    "Fits into the existing microservices architecture as the billing service. Communicates with the user service via events and exposes REST endpoints for the admin frontend to manage subscriptions and view billing history.",
    "",
    "## Agent Tips",
    "### Security",
    "- Tip one",
  ].join("\n");
}

describe("parseMarkdownSections", () => {
  it("extracts all 7 sections from valid prompt", () => {
    const sections = parseMarkdownSections(validPrompt());
    expect(sections.length).toBeGreaterThanOrEqual(7);
    const headings = sections.map((s) => s.heading);
    expect(headings).toContain("Objective");
    expect(headings).toContain("Context");
    expect(headings).toContain("Constraints");
    expect(headings).toContain("Expected Output");
    expect(headings).toContain("Validation Criteria");
    expect(headings).toContain("Architectural Alignment");
    expect(headings).toContain("Agent Tips");
  });

  it("preserves section content", () => {
    const sections = parseMarkdownSections(validPrompt());
    const objective = sections.find((s) => s.heading === "Objective");
    expect(objective).toBeDefined();
    expect(objective!.content).toContain("authentication");
  });

  it("handles preambles (text before first heading)", () => {
    const sections = parseMarkdownSections(validPromptWithPreamble());
    const headings = sections.map((s) => s.heading);
    expect(headings).toContain("Objective");
    expect(sections.length).toBeGreaterThanOrEqual(7);
  });

  it("returns empty array for empty string", () => {
    expect(parseMarkdownSections("")).toEqual([]);
  });

  it("returns empty array for text with no headings", () => {
    expect(parseMarkdownSections("just some text\nwithout any\nheadings")).toEqual([]);
  });

  it("handles subheadings (### level) within a ## section", () => {
    const sections = parseMarkdownSections(validPrompt());
    const tips = sections.find((s) => s.heading === "Agent Tips");
    expect(tips).toBeDefined();
    expect(tips!.content).toContain("### Security");
    expect(tips!.content).toContain("### Edge Cases");
    expect(tips!.content).toContain("### Common Bugs");
  });
});

describe("matchSectionId", () => {
  const known = [
    { heading: "Objective", id: "objective" },
    { heading: "Expected Output", id: "expectedOutput" },
  ];

  it("matches exact heading", () => {
    expect(matchSectionId("Objective", known)).toBe("objective");
  });

  it("matches case-insensitively", () => {
    expect(matchSectionId("objective", known)).toBe("objective");
    expect(matchSectionId("OBJECTIVE", known)).toBe("objective");
  });

  it("matches partial prefix", () => {
    expect(matchSectionId("Expected Output:", known)).toBe("expectedOutput");
  });

  it("returns original string for unknown headings", () => {
    expect(matchSectionId("Unknown Heading", known)).toBe("Unknown Heading");
  });
});

describe("validateExecutionPrompt", () => {
  it("passes a structurally valid prompt", () => {
    const result = validateExecutionPrompt(validPrompt());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes a valid prompt with preamble text", () => {
    const result = validateExecutionPrompt(validPromptWithPreamble());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when Objective section is missing", () => {
    const prompt = validPrompt().replace("## Objective", "## Missing");
    const result = validateExecutionPrompt(prompt);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "missing" && e.section === "objective")).toBe(true);
  });

  it("fails when Objective section is empty", () => {
    const prompt = validPrompt().replace(
      "Build a complete user authentication system with JWT tokens. This includes secure login, registration, password reset, and token refresh functionality. Must support role-based access control for admin and regular user roles.",
      "",
    );
    const result = validateExecutionPrompt(prompt);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "empty" && e.section === "objective")).toBe(true);
  });

  it("fails when Context section is missing", () => {
    const prompt = validPrompt().replace("## Context", "## Removed");
    const result = validateExecutionPrompt(prompt);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "missing" && e.section === "context")).toBe(true);
  });

  it("fails when Expected Output section is missing", () => {
    const prompt = validPrompt().replace("## Expected Output", "## Missing Output");
    const result = validateExecutionPrompt(prompt);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "missing" && e.section === "expectedOutput")).toBe(true);
  });

  it("fails when a required section is too short", () => {
    const lines = validPrompt().split("\n");
    const objIdx = lines.findIndex((l) => l.startsWith("Build a complete user authentication system"));
    lines[objIdx] = "Hi";
    const result = validateExecutionPrompt(lines.join("\n"));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "too_short")).toBe(true);
  });

  it("fails on duplicate sections", () => {
    const lines = validPrompt().split("\n");
    // Insert a second Objective section
    const insertAt = lines.findIndex((l) => l.startsWith("## Context"));
    lines.splice(insertAt, 0, "## Objective", "Another objective text here.");
    const result = validateExecutionPrompt(lines.join("\n"));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "duplicate" && e.section === "objective")).toBe(true);
  });

  it("fails when sections are out of order", () => {
    const lines = validPrompt().split("\n");
    // Swap Objective and Context
    const objIdx = lines.indexOf("## Objective");
    const ctxIdx = lines.indexOf("## Context");
    lines[objIdx] = "## Context";
    lines[ctxIdx] = "## Objective";
    const result = validateExecutionPrompt(lines.join("\n"));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "out_of_order")).toBe(true);
  });

  it("fails on empty prompt string", () => {
    const result = validateExecutionPrompt("");
    expect(result.valid).toBe(false);
    // All 7 required sections are missing
    const missingSections = result.errors.filter((e) => e.code === "missing");
    expect(missingSections.length).toBeGreaterThanOrEqual(7);
  });

  it("fails on prompt with only whitespace", () => {
    const result = validateExecutionPrompt("   \n\n  \n  ");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(7);
  });

  it("returns all structural errors, not just the first one", () => {
    const result = validateExecutionPrompt("");
    // Should report 7 missing sections, not stop at the first
    const missingCount = result.errors.filter((e) => e.code === "missing").length;
    expect(missingCount).toBe(7);
  });

  it("validates all 7 required sections are present", () => {
    const result = validateExecutionPrompt(validPrompt());
    expect(result.valid).toBe(true);
    const defs = EXECUTION_PROMPT_SECTIONS.filter((s) => s.required);
    expect(defs).toHaveLength(7);
  });
});

describe("extractSectionContent", () => {
  it("extracts content from a valid prompt", () => {
    const content = extractSectionContent(validPrompt(), "Objective");
    expect(content).toBeTruthy();
    expect(content).toContain("authentication");
  });

  it("returns null for non-existent section", () => {
    const content = extractSectionContent(validPrompt(), "Nonexistent");
    expect(content).toBeNull();
  });

  it("extracts content with bullet items intact", () => {
    const content = extractSectionContent(validPrompt(), "Constraints");
    expect(content).toBeTruthy();
    expect(content).toContain("bcrypt");
  });
});
