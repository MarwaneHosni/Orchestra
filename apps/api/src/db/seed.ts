import { getDb, closeDb } from "./index.js";
import { questions } from "./schema/questions.js";
import { QUESTIONS, PHASE_ORDER } from "../lib/interview/questions.js";
import { loadConfig } from "../lib/config.js";

async function main() {
  loadConfig();
  const db = getDb();

  console.log("Seeding questions...");

  const existing = await db.select({ id: questions.id }).from(questions);
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing questions — skipping seed.`);
    await closeDb();
    process.exit(0);
  }

  const rows = QUESTIONS.map((q) => ({
    phaseType: q.phaseType,
    order: q.order,
    text: q.text,
    type: q.type,
    options: q.options ? JSON.stringify(q.options) : null,
    required: q.required,
    dependencyRules: q.dependsOn ? JSON.stringify(q.dependsOn) : null,
    validationRules: q.validation ? JSON.stringify(q.validation) : null,
    captureAs: q.captureAs ? JSON.stringify(q.captureAs) : null,
  }));

  await db.insert(questions).values(rows);

  const total = rows.length;
  const byPhase = PHASE_ORDER.map((p) => {
    const count = rows.filter((r) => r.phaseType === p).length;
    return `  ${p}: ${count}`;
  }).join("\n");

  console.log(`Seeded ${total} questions across ${PHASE_ORDER.length} phases:\n${byPhase}`);
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
