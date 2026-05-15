#!/usr/bin/env node

import { execSync } from "child_process";

const target = process.argv[2] ?? "all";

const targets = {
  api: "@orchestra/api",
  web: "@orchestra/web",
  worker: "@orchestra/worker",
};

if (target === "all") {
  console.log("Starting api, web & worker in dev mode...");
  execSync(
    "pnpm run --parallel --filter @orchestra/api --filter @orchestra/web --filter @orchestra/worker dev",
    { stdio: "inherit", shell: true },
  );
} else if (targets[target]) {
  execSync(`pnpm --filter ${targets[target]} dev`, { stdio: "inherit", shell: true });
} else {
  console.error(`Unknown target: ${target}`);
  console.error(`Available: ${Object.keys(targets).join(", ")}`);
  process.exit(1);
}
