/**
 * READ-ONLY strict audit for research batch #707–728. No DB writes.
 *   npx tsx --import ./script/load-env.ts script/audit-research-strict-readonly.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { runPublishPipelineGate } from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";
import { draftHasSatisfactoryOutline } from "../server/storyCoverBridge";
import { parseProdSyncFromDescription } from "../shared/prodSyncMetadata";

const ids = Array.from({ length: 22 }, (_, i) => 707 + i);
const rows = await db
  .select()
  .from(draftEbooks)
  .where(inArray(draftEbooks.id, ids))
  .orderBy(draftEbooks.id);

console.log("\n=== Research batch #707–728 — READ-ONLY strict audit ===\n");
console.log("No changes. strict = structure + cover + genre + dialogue + climax (fiction)\n");

let pass = 0;
let fail = 0;
const problems: Array<{ id: number; title: string; issues: string[] }> = [];

for (const d of rows) {
  const words = (d.content || "").split(/\s+/).length;
  const cover = draftHasPublishableCover(d);
  const outlineOk = draftHasSatisfactoryOutline(d);
  const briefMatch = (d.outline || "").match(/EditorialBrief score:(\d+)/);
  const briefScore = briefMatch ? briefMatch[1] : "n/a";
  const synced = parseProdSyncFromDescription(d.description);

  const gate = await runPublishPipelineGate(d, { strict: true });
  if (gate.pass) pass++;
  else fail++;

  console.log(
    `#${d.id} [${d.status}] ${gate.pass ? "PASS" : "FAIL"} | ${(d.title || "").slice(0, 44)}`,
  );
  console.log(
    `  cover=${cover} outline=${outlineOk} editorialBrief=${briefScore}/10 words=${words} prodSync=${synced ? "yes" : "never"}`,
  );
  if (!gate.pass) {
    for (const iss of gate.issues.slice(0, 8)) console.log(`  - ${iss}`);
    if (gate.issues.length > 8) console.log(`  - ... +${gate.issues.length - 8} more`);
    problems.push({ id: d.id, title: d.title || "", issues: gate.issues });
  }
  console.log("");
}

console.log("--- Summary ---");
console.log(`PASS: ${pass} / ${rows.length}`);
console.log(`FAIL: ${fail} / ${rows.length}`);

if (problems.length) {
  console.log("\nBooks that would NOT pass strict gate today:");
  for (const p of problems) {
    console.log(`  #${p.id} ${p.title.slice(0, 40)} — ${p.issues.length} issue(s)`);
  }
}

process.exit(0);
