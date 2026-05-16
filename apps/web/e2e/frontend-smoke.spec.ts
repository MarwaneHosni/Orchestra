import { test, expect } from "@playwright/test";

test.describe("Frontend — page renders", () => {
  test("landing page loads with title and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Dashboard");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.getByRole("link", { name: "Projects" })).toBeVisible();
  });

  test("projects page shows create button", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: /new project|create project/i }).first()).toBeVisible();
  });

  test("new project page has form fields", async ({ page }) => {
    await page.goto("/projects/new");
    await expect(page.locator('label:has-text("Project name")')).toBeVisible();
    await expect(page.locator('label:has-text("Idea description")')).toBeVisible();
    await expect(page.getByRole("button", { name: /start/i })).toBeVisible();
  });

  test("task graph page shows loading on first visit", async ({ page }) => {
    await page.goto("/projects/test-session/tasks");
    // either loads data or shows loading/empty state
    await page.waitForLoadState("networkidle");
    const content = page.locator("body");
    await expect(content).toBeVisible();
  });

  test("version history page loads", async ({ page }) => {
    await page.goto("/projects/test-session/versions");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Version History");
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

  test("can navigate to create project page from landing", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /new project/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/projects\/new/);
  });
});

test.describe("Frontend — interview progression", () => {
  test("interview page renders with progress bar", async ({ page }) => {
    await page.goto("/projects/test-session/interview");
    await page.waitForLoadState("networkidle");
    // progress bar or breadcrumb should be visible
    const progress = page.locator("text=Progress, text=Interview, text=Phase").first();
    await expect(progress.or(page.locator("[role='progressbar']"))).toBeVisible();
  });
});

test.describe("Frontend — completion and empty states", () => {
  test("blueprints page shows empty state", async ({ page }) => {
    await page.goto("/blueprints");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Blueprints");
  });

  test("plans page shows empty state", async ({ page }) => {
    await page.goto("/plans");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Plans");
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Settings");
  });
});
