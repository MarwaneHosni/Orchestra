import { test, expect } from "@playwright/test";

const API = "http://localhost:3000";

test.describe("API — core workflow E2E", () => {
  test("0. creates a project and completes interview via the API", async () => {
    // Create project
    const createRes = await fetch(`${API}/api/v1/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaText: "E2E test project for full workflow validation." }),
    });
    expect(createRes.ok).toBe(true);
    const created = await createRes.json();
    expect(created.projectId).toBeTruthy();
    expect(created.sessionId).toBeTruthy();

    const sessionId = created.sessionId;

    // Start interview
    const startRes = await fetch(`${API}/api/v1/interviews/${sessionId}/start`, {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(startRes.ok).toBe(true);

    // Answer all questions
    const apiKey = "ENCRYPTION_KEY";
    const originalKey = process.env[apiKey];
    process.env[apiKey] = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    let maxLoops = 50;
    while (maxLoops-- > 0) {
      const nextRes = await fetch(`${API}/api/v1/interviews/${sessionId}/next`);
      expect(nextRes.ok).toBe(true);
      const next = await nextRes.json();
      if (!next.question) break;

      const answerRes = await fetch(`${API}/api/v1/interviews/${sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: next.question.id,
          value: "E2E answer with sufficient detail.",
          confidence: "high",
        }),
      });
      expect(answerRes.ok).toBe(true);
    }
    expect(maxLoops).toBeGreaterThan(0);

    // Verify all questions answered
    const finalRes = await fetch(`${API}/api/v1/interviews/${sessionId}/next`);
    expect(finalRes.ok).toBe(true);
    const final = await finalRes.json();
    expect(final.question).toBeNull();
    expect(final.answered).toBeGreaterThanOrEqual(final.total);

    // Generate blueprint
    const blueprintRes = await fetch(`${API}/api/v1/interviews/${sessionId}/generate`, {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(blueprintRes.ok).toBe(true);
    const blueprint = await blueprintRes.json();
    expect(blueprint.phases).toHaveLength(12);
    expect(blueprint.overallConfidence).toBeGreaterThan(0);

    if (originalKey) process.env[apiKey] = originalKey;

    // Use the created project's planId for subsequent graph tests
    test.setTimeout(60000);
  }).timeout(30000);

  test("1. generates a task graph after project creation", async () => {
    const res = await fetch(`${API}/api/v1/plans/e2e-plan-${test.info().title.replace(/\s/g, "-")}/tasks`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.tasks.length).toBeGreaterThanOrEqual(18);
    expect(body.dependencies.length).toBeGreaterThan(0);
    expect(body.planVersion).toBe(1);
    expect(body.tasks[0].status).toBe("ready");
  });

  test("2. retrieves a valid prompt for each generated task", async () => {
    const planId = `e2e-prompt-${Date.now()}`;
    const tasksRes = await fetch(`${API}/api/v1/plans/${planId}/tasks`);
    expect(tasksRes.ok).toBe(true);
    const tasks = await tasksRes.json();

    for (const task of tasks.tasks.slice(0, 3)) {
      const res = await fetch(`${API}/api/v1/plans/${planId}/tasks/${task.id}/prompt`);
      expect(res.ok).toBe(true);
      const prompt = await res.json();
      expect(prompt.status).toBe("complete");
      expect(prompt.promptText.length).toBeGreaterThan(200);
      expect(prompt.planVersion).toBe(1);
    }
  });

  test("3. exports a complete prompt bundle matching graph counts", async () => {
    const planId = `e2e-bundle-${Date.now()}`;
    const graphRes = await fetch(`${API}/api/v1/plans/${planId}/tasks`);
    expect(graphRes.ok).toBe(true);
    const graph = await graphRes.json();

    const res = await fetch(`${API}/api/v1/plans/${planId}/prompts/export`);
    expect(res.ok).toBe(true);
    const bundle = await res.json();
    expect(bundle.exportFormat).toBe("orchestra-prompt-bundle-v1");
    expect(bundle.taskCount).toBe(graph.tasks.length);
    expect(bundle.taskCount).toBe(bundle.promptCount);
    expect(bundle.tasks.every((t: any) => t.promptText)).toBe(true);
  });

  test("4. version 2 derives from version 1 without altering v1", async () => {
    const planId = `e2e-version-${Date.now()}`;

    // Generate v1
    const v1Res = await fetch(`${API}/api/v1/plans/${planId}/tasks`);
    expect(v1Res.ok).toBe(true);
    const v1 = await v1Res.json();
    expect(v1.planVersion).toBe(1);

    // Generate v2
    const v2Res = await fetch(`${API}/api/v1/plans/${planId}/tasks?version=2`);
    expect(v2Res.ok).toBe(true);
    const v2 = await v2Res.json();
    expect(v2.planVersion).toBe(2);

    // v2 export shows derivation
    const b2Res = await fetch(`${API}/api/v1/plans/${planId}/prompts/export?version=2`);
    expect(b2Res.ok).toBe(true);
    const b2 = await b2Res.json();
    expect(b2.derivedFromPlanVersion).toBe(1);

    // v1 still accessible unchanged
    const b1Res = await fetch(`${API}/api/v1/plans/${planId}/prompts/export?version=1`);
    expect(b1Res.ok).toBe(true);
    const b1 = await b1Res.json();
    expect(b1.taskCount).toBe(v1.tasks.length);
  });

  test("5. version-specific exports are isolated", async () => {
    const planId = `e2e-isolate-${Date.now()}`;

    await fetch(`${API}/api/v1/plans/${planId}/tasks`);
    await fetch(`${API}/api/v1/plans/${planId}/tasks?version=2`);

    const v1Export = await (await fetch(`${API}/api/v1/plans/${planId}/prompts/export?version=1`)).json();
    const v2Export = await (await fetch(`${API}/api/v1/plans/${planId}/prompts/export?version=2`)).json();

    expect(v1Export.planVersion).toBe(1);
    expect(v2Export.planVersion).toBe(2);
    expect(v1Export.taskCount).toBeGreaterThan(0);
    expect(v2Export.taskCount).toBeGreaterThan(0);
  });
});

test.describe("API — error handling", () => {
  test("returns 404 for unknown plan", async () => {
    const res = await fetch(`${API}/api/v1/plans/nonexistent/tasks`);
    expect(res.status).toBe(404);
  });

  test("returns 404 for unknown version", async () => {
    const res = await fetch(`${API}/api/v1/plans/test-plan/prompts/export?version=99`);
    expect(res.status).toBe(404);
  });

  test("rejects invalid version parameter", async () => {
    const res = await fetch(`${API}/api/v1/plans/test-plan/tasks?version=-1`);
    expect(res.ok).toBe(false);
  });

  test("rejects empty idea text on project creation", async () => {
    const res = await fetch(`${API}/api/v1/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaText: "" }),
    });
    expect(res.ok).toBe(false);
    const body = await res.json().catch(() => ({}));
    expect(body?.error?.message ?? "").toBeTruthy();
  });
});
