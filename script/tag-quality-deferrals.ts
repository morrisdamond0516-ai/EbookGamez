/**
 * Tag structural-gate failures with a Content Studio "fix later" note.
 * Does NOT unpublish, demote, or change status — books stay published/good.
 *
 *   npx tsx --import ./script/load-env.ts script/tag-quality-deferrals.ts
 *   npx tsx --import ./script/load-env.ts script/tag-quality-deferrals.ts --dry-run
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { runPublishPipelineGate } from "../server/contentStudio";
import {
  withQualityDeferralInDescription,
  parseQualityDeferralFromDescription,
} from "../shared/qualityDeferralMetadata";

const dryRun = process.argv.includes("--dry-run");

const drafts = await db.select().from(draftEbooks).where(eq(draftEbooks.status, "published"));
console.log(`\n=== Tag quality deferrals (${drafts.length} published) ${dryRun ? "DRY RUN" : ""} ===\n`);

let tagged = 0;
let already = 0;
let skippedPass = 0;

for (const d of drafts) {
  const words = (d.content || "").split(/\s+/).length;
  if (words <= 500) {
    skippedPass++;
    continue;
  }
  const gate = await runPublishPipelineGate(d, { verifyGenre: false, dialogueCheck: false });
  if (gate.pass) {
    skippedPass++;
    continue;
  }

  const existing = parseQualityDeferralFromDescription(d.description);
  if (existing) {
    already++;
    continue;
  }

  const reason = gate.issues.some((i) => /illustration|ILLUSTRATION|visual|pending/i.test(i))
    ? "missing_illustrations"
    : "structural_gate";
  const note =
    reason === "missing_illustrations"
      ? "Structural gate: missing illustrations — fix later. Still considered good / stay published."
      : "Structural gate failed — fix later. Still considered good / stay published.";

  const description = withQualityDeferralInDescription(d.description, {
    reason,
    note,
    taggedAt: new Date().toISOString(),
    issues: gate.issues.slice(0, 8),
  });

  console.log(`#${d.id} ${(d.title || "").slice(0, 45)} — ${reason} (${gate.issues.length} issues)`);
  if (!dryRun) {
    await db.update(draftEbooks).set({ description }).where(eq(draftEbooks.id, d.id));
  }
  tagged++;
}

console.log(`\nTagged: ${tagged} | already tagged: ${already} | pass/skip: ${skippedPass}`);
console.log(dryRun ? "(dry run — no DB writes)" : "Done — status unchanged (still published).");
