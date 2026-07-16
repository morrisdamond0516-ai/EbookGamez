/**
 * READ-ONLY full-library quality audit — does not modify any data.
 *   npx tsx --import ./script/load-env.ts script/audit-all-books-readonly.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import {
  runPublishPipelineGate,
  scanContentCompleteness,
} from "../server/contentStudio";
import { assessProdSyncStatus } from "../shared/prodSyncMetadata";
import { parseOutlineIllustrationSlots } from "../shared/outlineIllustrations";
import { draftHasPublishableCover } from "../server/coverStorage";

const RESEARCH = new Set(
  Array.from({ length: 22 }, (_, i) => 707 + i),
);

const drafts = await db.select().from(draftEbooks).orderBy(draftEbooks.id);
console.log(`\n=== LIBRARY AUDIT (${drafts.length} drafts) — READ ONLY ===\n`);

const byStatus: Record<string, number> = {};
for (const d of drafts) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
console.log("Status counts:", byStatus);

const gateFail: Array<{ id: number; title: string; status: string; issues: string[] }> = [];
const gatePass: number[] = [];
const research: Array<{
  id: number;
  title: string;
  status: string;
  words: number;
  outlineSlots: number;
  gate: boolean;
  topIssues: string[];
}> = [];

for (const d of drafts) {
  const words = (d.content || "").split(/\s+/).length;
  const outlineSlots = parseOutlineIllustrationSlots(d.outline).length;
  const gate = await runPublishPipelineGate(d, { verifyGenre: false, dialogueCheck: false });

  if (!gate.pass && words > 500) {
    gateFail.push({
      id: d.id,
      title: (d.title || "").slice(0, 55),
      status: d.status,
      issues: gate.issues.slice(0, 5),
    });
  } else if (gate.pass && d.status === "published") {
    gatePass.push(d.id);
  }

  if (RESEARCH.has(d.id)) {
    research.push({
      id: d.id,
      title: (d.title || "").slice(0, 45),
      status: d.status,
      words,
      outlineSlots,
      gate: gate.pass,
      topIssues: gate.issues.slice(0, 3),
    });
  }
}

console.log(`\n--- Publish gate (no dialogue, structural + visual) ---`);
console.log(`Pass (published only counted): ${gatePass.length}`);
console.log(`Fail (with content): ${gateFail.length}`);

const failByStatus: Record<string, number> = {};
for (const f of gateFail) failByStatus[f.status] = (failByStatus[f.status] || 0) + 1;
console.log("Failures by status:", failByStatus);

console.log(`\n--- Research batch #707–728 ---`);
for (const r of research) {
  const draft = drafts.find((x) => x.id === r.id)!;
  const prod =
    draft.status === "published" ? assessProdSyncStatus(draft) : null;
  const sync =
    draft.status === "published" && prod
      ? prod.needsProdPush
        ? "needs-prod-push"
        : "synced"
      : "-";
  console.log(
    `#${r.id} [${r.status}] ${r.words}w outlineSlots=${r.outlineSlots} gate=${r.gate ? "PASS" : "FAIL"} ${sync} | ${r.title}`,
  );
  if (!r.gate) for (const i of r.topIssues) console.log(`    - ${i}`);
}

console.log(`\n--- Top failures (first 40) ---`);
for (const f of gateFail.slice(0, 40)) {
  console.log(`#${f.id} [${f.status}] ${f.title}`);
  for (const i of f.issues) console.log(`  - ${i}`);
}

const scan = await scanContentCompleteness();
const scanFail = scan.filter((s) => s.issues.length > 0 && s.words > 500);
console.log(`\n--- scanContentCompleteness issues (${scanFail.length} books with content) ---`);
const issueCounts = new Map<string, number>();
for (const s of scanFail) {
  for (const issue of s.issues) {
    const key = issue.replace(/Ch\d+/g, "ChN").replace(/\d+/g, "N").slice(0, 60);
    issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
  }
}
console.log("Most common issue patterns:");
[...issueCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([k, n]) => console.log(`  ${n}x ${k}`));

const publishedNeedProd = drafts.filter((d) => {
  if (d.status !== "published") return false;
  return assessProdSyncStatus(d).needsProdPush;
});
console.log(`\n--- Published needing prod push: ${publishedNeedProd.length} ---`);
for (const d of publishedNeedProd.slice(0, 30)) {
  const s = assessProdSyncStatus(d);
  console.log(`  #${d.id} [${s.reason}] ${(d.title || "").slice(0, 50)}`);
}
