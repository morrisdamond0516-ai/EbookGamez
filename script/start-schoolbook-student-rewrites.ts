/**
 * Start student-voice full regenerations for schoolbooks whose content was cleared
 * by reorient-schoolbooks-student-voice.ts
 *
 *   npx tsx --import ./script/load-env.ts script/start-schoolbook-student-rewrites.ts
 *   npx tsx --import ./script/load-env.ts script/start-schoolbook-student-rewrites.ts 729 730
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { inArray } from "drizzle-orm";
import { generateContentForDraft } from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";
import { parseWritingBriefFromDescription } from "../server/contentStudio";

const argIds = process.argv.slice(2).map((a) => parseInt(a, 10)).filter((n) => !Number.isNaN(n));
const DEFAULT_IDS = [729, 730, 731, 732, 733, 735, 738];
const ids = argIds.length ? argIds : DEFAULT_IDS;

const drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
console.log(`Queue ${drafts.length} schoolbook regenerations (student take-home voice)...`);

for (const d of drafts.sort((a, b) => a.id - b.id)) {
  const brief = parseWritingBriefFromDescription(d.description);
  const studentVoice = /STUDENT TEXTBOOK|take-home textbook|speaks to the student/i.test(
    brief?.toneAndVoice || "",
  );
  console.log(
    `\n#${d.id} ${d.title} cover=${draftHasPublishableCover(d)} studentBrief=${studentVoice} words=${(d.content || "").split(/\s+/).filter(Boolean).length}`,
  );
  if (!draftHasPublishableCover(d)) {
    console.log("  SKIP — no cover");
    continue;
  }
  if ((d.content || "").split(/\s+/).filter(Boolean).length > 2000) {
    console.log("  SKIP — still has substantial content (clear first via reorient script)");
    continue;
  }
  try {
    await generateContentForDraft(d.id);
    console.log(`  DONE #${d.id}`);
  } catch (err: any) {
    console.error(`  FAIL #${d.id}:`, err?.message || err);
  }
}

console.log("\nAll queued regenerations finished (or failed).");
process.exit(0);
