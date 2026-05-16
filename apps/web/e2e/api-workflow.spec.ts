import { test, expect } from "@playwright/test";

const API = "http://localhost:3000";

test.describe("API — core workflow E2E", () => {
  const planId = `e2e-plan-${Date.now()}`;

  test("1. generates a task graph from the API", async () => {
    const res = await fetch(`${API}/api/v1/plans/${planId}/tasks`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.tasks.length).toBeGreaterThanOrEqual(18);
    expect(body.dependencies.length).toBeGreaterThan(0);
    expect(body.planVersion).toBe(1);
    expect(body.tasks[0].status).toBe("ready");
  });

  test("2. retrieves a prompt for the first task", async () => {
    const tasksRes = await fetch(`${API}/api/v1/plans/${planId}/tasks`);
    const tasks = await tasksRes.json();
    const firstTaskId = tasks.tasks[0].id;

    const res = await fetch(`${API}/api/v1/plans/${planId}/tasks/${firstTaskId}/prompt`);
    expect(res.ok).toBe(true);
    const prompt = await res.json();
    expect(prompt.status).toBe("complete");
    expect(prompt.promptText.length).toBeGreaterThan(200);
    expect(prompt.planVersion).toBe(1);
  });

  test("3. exports a prompt bundle in the bundle format", async () => {
    const res = await fetch(`${API}/api/v1/plans/${planId}/prompts/export`);
    expect(res.ok).toBe(true);
    const bundle = await res.json();
    expect(bundle.exportFormat).toBe("orchestra-prompt-bundle-v1");
    expect(bundle.taskCount).toBeGreaterThanOrEqual(18);
    expect(bundle.taskCount).toBe(bundle.promptCount);
    expect(bundle.tasks[0].promptText).toBeTruthy();
    expect(bundle.tasks[0].promptValidationStatus).toBe("complete");
  });

  test("4. generates a second version and verifies v1 stays intact", async () => {
    const res1 = await fetch(`${API}/api/v1/plans/${planId}/tasks?version=2`);
    expect(res1.ok).toBe(true);
    const v2 = await res1.json();
    expect(v2.planVersion).toBe(2);

    const res2 = await fetch(`${API}/api/v1/plans/${planId}/prompts/export?version=2`);
    expect(res2.ok).toBe(true);
    const bundle2 = await res2.json();
    expect(bundle2.derivedFromPlanVersion).toBe(1);

    const res3 = await fetch(`${API}/api/v1/plans/${planId}/prompts/export?version=1`);
    expect(res3.ok).toBe(true);
    const bundle1 = await res3.json();
    expect(bundle1.taskCount).toBeGreaterThan(0);
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

  test("returns error for invalid version parameter", async () => {
    const res = await fetch(`${API}/api/v1/plans/test-plan/tasks?version=-1`);
    expect(res.ok).toBe(false);
  });
});
