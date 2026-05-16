import { test, expect } from "@playwright/test";

test.describe("Frontend — page renders", () => {
  test("landing page shows heading and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Dashboard");
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("projects page has create button", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /new project/i }).first()).toBeVisible();
  });

  test("new project form renders with required fields", async ({ page }) => {
    await page.goto("/projects/new");
    await expect(page.getByText("Project details")).toBeVisible();
    await expect(page.getByPlaceholder(/e\.g/i).first()).toBeVisible();
  });

  test("version history page renders heading", async ({ page }) => {
    await page.goto("/projects/test-session/versions");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Version History");
  });

  test("empty states render for blueprints and plans", async ({ page }) => {
    await page.goto("/blueprints");
    await expect(page.locator("h1")).toContainText("Blueprints");

    await page.goto("/plans");
    await expect(page.locator("h1")).toContainText("Plans");
  });
});

test.describe("Frontend — navigation", () => {
  test("navbar links navigate correctly", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/projects/);

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Frontend — task graph page", () => {
  test("task graph page loads without crash", async ({ page }) => {
    await page.goto("/projects/e2e-task-view/tasks");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Frontend — interview page", () => {
  test("interview page renders without crash", async ({ page }) => {
    await page.goto("/projects/e2e-interview-view/interview");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
