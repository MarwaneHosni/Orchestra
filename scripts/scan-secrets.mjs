#!/usr/bin/env node
/**
 * Secret scanner — blocks credentials from being committed.
 *
 * Usage:
 *   node scripts/scan-secrets.mjs --staged   # scan files staged for commit (pre-commit hook)
 *   node scripts/scan-secrets.mjs --all      # scan every git-tracked file
 *
 * Exits with code 1 if any potential secret is found. Matched values are
 * masked in the output so this tool never re-leaks a credential into logs.
 *
 * Known test fixtures / documentation placeholders are allow-listed below.
 */

import { execFileSync } from "node:child_process";

const MODE = process.argv.includes("--all") ? "all" : "staged";

// --- Patterns -----------------------------------------------------------------
// Each entry: a name and a global RegExp matching the raw secret.
const PATTERNS = [
  { name: "OpenRouter API key", re: /sk-or-v1-[A-Za-z0-9]{32,}/g },
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "OpenAI project key", re: /sk-proj-[A-Za-z0-9_-]{20,}/g },
  { name: "OpenAI API key", re: /sk-[A-Za-z0-9]{32,}/g },
  { name: "AWS access key id", re: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: "JSON Web Token", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  {
    name: "Assigned secret value",
    re: /(?:ENCRYPTION_KEY|API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|ACCESS_KEY|PRIVATE_KEY)[ \t]*[=:][ \t]*["']?([A-Za-z0-9+/_-]{20,})["']?/gi,
    captureGroup: 1,
  },
];

// --- Allow-list ---------------------------------------------------------------
// Values matching any of these are considered fake/placeholder and ignored.
const ALLOWLIST = [
  /^(?:sk-ant-my-secret-api-key-12345)$/,
  /^(?:sk-abc123def456ghi789jkl0)$/,
  /^(?:sk-ant-api03-abcdef1234567890abcd)$/,
  /^(?:abcdef0123456789)+$/,
  /^(.)\1+$/, // repeated single character (e.g. all-zero test fixtures)
  /(?:your|my|the)[-_]?(?:secret|key|token|password|character|hex)/i,
  /(?:example|placeholder|dummy|fake|sample|changeme|redact|replace|xxxx|here|character)/i,
  /^(?:process\.env|env\.|os\.environ|\$\{?)/i,
  /^[<[].*[>\]]$/,
  /^(?:orchestra_dev|orchestra|postgres|localhost)$/i,
];

function isAllowlisted(value) {
  return ALLOWLIST.some((re) => re.test(value));
}

function mask(value) {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

// --- File selection -----------------------------------------------------------
function listFiles() {
  const args = MODE === "all" ? ["ls-files"] : ["diff", "--cached", "--name-only", "--diff-filter=ACM"];
  const out = execFileSync("git", args, { encoding: "utf-8" });
  return out
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);
}

function readContent(file) {
  if (MODE === "all") {
    return execFileSync("git", ["show", `HEAD:${file}`], {
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
    });
  }
  return execFileSync("git", ["show", `:${file}`], {
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

const BINARY_EXT = /\.(?:png|jpe?g|gif|ico|webp|pdf|zip|gz|tgz|woff2?|ttf|eot|mp4|mov|wasm|node|lock)$/i;
const SKIP_FILES = new Set(["scripts/scan-secrets.mjs", "pnpm-lock.yaml", "package-lock.json"]);

// --- Scan ---------------------------------------------------------------------
const files = listFiles();
const findings = [];
const seen = new Set();

for (const file of files) {
  if (BINARY_EXT.test(file) || SKIP_FILES.has(file)) continue;

  let content;
  try {
    content = readContent(file);
  } catch {
    continue; // deleted/renamed/unreadable — nothing to scan
  }
  if (content.includes("\u0000")) continue; // binary

  const lines = content.split(/\r?\n/);
  for (const { name, re, captureGroup } of PATTERNS) {
    re.lastIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(line)) !== null) {
        const value = captureGroup ? match[captureGroup] : match[0];
        if (!value || isAllowlisted(value)) continue;
        const key = `${file}:${i + 1}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ file, line: i + 1, name, masked: mask(value) });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`\n✖ Potential secret(s) detected in ${findings.length} location(s):\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.name}  (${f.masked})`);
  }
  console.error(
    "\nCommit blocked. Remove the secret, rotate the credential, and use an environment variable instead.\n" +
      "If this is a known test fixture/placeholder, add it to the allow-list in scripts/scan-secrets.mjs.\n",
  );
  process.exit(1);
}

console.log(`✓ scan-secrets: no secrets found (${MODE === "all" ? "tracked files" : "staged files"}).`);
