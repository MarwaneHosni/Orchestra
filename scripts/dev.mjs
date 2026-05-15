#!/usr/bin/env node

import { execSync } from "child_process";

const target = process.argv[2] ?? "all";

const start = (filter) => {
  execSync(`pnpm --filter ${filter} dev`, { stdio: "inherit", shell: true });
};

const targets = {
  api: "@orchestra/api",
  web: "@orchestra/web",
  worker: "@orchestra/worker",
};

if (target === "all") {
  console.log("Starting api & worker in dev mode (web not yet configured)...");
  execSync("pnpm run --parallel --filter @orchestra/api --filter @orchestra/worker dev", {
    stdio: "inherit",
    shell: true,
  });
} else if (targets[target]) {
  start(targets[target]);
} else {
  console.error(`Unknown target: ${target}`);
  console.error(`Available: ${Object.keys(targets).join(", ")}`);
  process.exit(1);
}
