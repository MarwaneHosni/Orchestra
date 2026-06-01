#!/usr/bin/env node

import { execSync } from "child_process";

const target = process.argv[2] ?? "all";

const targets = {
  api: "@orchestra/api",
  web: "@orchestra/web",
  worker: "@orchestra/worker",
};

const env = { ...process.env };

if (target === "all") {
  console.log("Starting api, web & worker in dev mode...");
  // Set NEXT_PUBLIC_API_URL so the frontend calls the API directly (bypasses
  // the Next.js proxy, which has no configurable timeout and can ECONNRESET
  // during long-running AI generation calls).
  if (!env.NEXT_PUBLIC_API_URL) {
    env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
  }
  execSync(
    "pnpm run --parallel --filter @orchestra/api --filter @orchestra/web --filter @orchestra/worker dev",
    { stdio: "inherit", shell: true, env },
  );
} else if (targets[target]) {
  execSync(`pnpm --filter ${targets[target]} dev`, { stdio: "inherit", shell: true, env });
} else {
  console.error(`Unknown target: ${target}`);
  console.error(`Available: ${Object.keys(targets).join(", ")}`);
  process.exit(1);
}
