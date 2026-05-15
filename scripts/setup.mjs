#!/usr/bin/env node

import { execSync } from "child_process";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");

function run(description, command) {
  console.log(`\n▶ ${description}`);
  execSync(command, { cwd: ROOT, stdio: "inherit", shell: true });
}

function checkDocker() {
  try {
    execSync("docker info", { stdio: "pipe", shell: true });
  } catch {
    console.error("ERROR: Docker is not running. Start Docker Desktop or the Docker daemon first.");
    process.exit(1);
  }
}

function waitForHealthy() {
  return new Promise((resolvePromise, reject) => {
    const start = Date.now();
    const timeout = 60_000;
    const poll = () => {
      if (Date.now() - start > timeout) {
        console.error("   Timed out waiting for PostgreSQL to become healthy.");
        console.error("   Run `docker compose ps` to check the container status.");
        reject(new Error("timeout"));
        return;
      }
      try {
        const out = execSync(`docker compose ps postgres --format json`, {
          cwd: ROOT,
          encoding: "utf-8",
          stdio: "pipe",
          shell: true,
        });
        if (out.includes('"Health": "healthy"')) {
          resolvePromise();
        } else {
          setTimeout(poll, 1000);
        }
      } catch {
        setTimeout(poll, 1000);
      }
    };
    poll();
  });
}

// ---------------------------------------------------------------------------
// 1. Seed .env if missing
// ---------------------------------------------------------------------------
if (!existsSync(ENV_FILE)) {
  console.log("⚠  No .env file found. Creating one from .env.example ...");
  copyFileSync(ENV_EXAMPLE, ENV_FILE);
  console.log("   → Edit .env to add your API keys before running AI features.");
}

// ---------------------------------------------------------------------------
// 2. Validate prerequisites
// ---------------------------------------------------------------------------
checkDocker();

// ---------------------------------------------------------------------------
// 3. Start Docker services
// ---------------------------------------------------------------------------
run("Start Docker Compose services", "docker compose up -d");

// ---------------------------------------------------------------------------
// 4. Wait for PostgreSQL health check
// ---------------------------------------------------------------------------
console.log("\n▶ Waiting for PostgreSQL to become healthy ...");
await waitForHealthy();
console.log("   PostgreSQL is ready.");

// ---------------------------------------------------------------------------
// 5. Install dependencies & build
// ---------------------------------------------------------------------------
run("Install npm dependencies", "pnpm install");
run("Build all packages", "pnpm build");

console.log("\n✓ Setup complete. Run `pnpm dev` to start the application.");
