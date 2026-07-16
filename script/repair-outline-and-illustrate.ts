/**
 * Reset illustration markers to outline-exact descriptions, regenerate images, publish.
 *
 *   npm run repair:outline-illustrate -- --id 724
 *   npm run repair:outline-illustrate -- --id 724 725 --dry-run
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  resetContentIllustrationsToOutline,
  revertBatchRepairPendingMarkers,
  parseOutlineIllustrationSlots,
} from "../shared/outlineIllustrations";
import {
  unwrapNonImageIllustrationMarkers,
  isPlannerGenre,
  stripFakeWorksheetIllustrationMarkers,
} from "../shared/activityBookContent";
import {
  generateIllustrations,
  runPublishPipelineGate,
  publishDraft,
} from "../server/contentStudio";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const idIdx = args.indexOf("--id");
const ids =
  idIdx >= 0
    ? args
        .slice(idIdx + 1)
        .map((a) => parseInt(a, 10))
        .filter((n) => !Number.isNaN(n))
    : [724, 725, 727];

const rows = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));

for (const draft of rows) {
  const title = draft.title || `Draft #${draft.id}`;
  console.log(`\n=== #${draft.id} ${title} [${draft.status}] ===`);

  let content = draft.content || "";
  if (isPlannerGenre(draft.genre)) {
    const u = unwrapNonImageIllustrationMarkers(content);
    content = u.content;
    console.log(`  planner unwrap: ${u.removed}`);
  } else {
    const rev = revertBatchRepairPendingMarkers(content, draft.outline);
    content = rev.content;
    const fake = stripFakeWorksheetIllustrationMarkers(content);
    content = fake.content;
    console.log(`  batch-repair revert: ${rev.removed}, fake stripped: ${fake.removed}`);
  }

  const slots = parseOutlineIllustrationSlots(draft.outline);
  if (slots.length > 0) {
    const reset = resetContentIllustrationsToOutline(content, draft.outline);
    content = reset.content;
    console.log(`  outline reset: ${reset.slotCount} slots (stripped ${reset.stripped} old markers)`);
  } else {
    console.log(`  no outline illustration slots — skipping marker reset`);
  }

  if (dryRun) {
    const pending = [...content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
      const p = m[1].trim();
      return !p.startsWith("/") && !p.startsWith("http");
    }).length;
    console.log(`  [dry-run] would save + generate ${pending} image(s)`);
    continue;
  }

  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));

  const pending = [...content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  }).length;

  if (pending > 0) {
    console.log(`  generating ${pending} illustration(s) from outline markers...`);
    try {
      content = await generateIllustrations(
        content,
        draft.genre || "General",
        title,
        draft.id,
      );
      await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
      console.log(`  illustrations generated`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  illustration generation failed: ${msg}`);
      continue;
    }
  } else {
    console.log(`  no pending markers — skip generation`);
  }

  const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draft.id));
  const gate = await runPublishPipelineGate(fresh, { verifyGenre: false, dialogueCheck: false });
  if (!gate.pass) {
    console.log(`  publish blocked: ${gate.issues.join("; ")}`);
    continue;
  }

  if (fresh.status !== "published") {
    try {
      const bookId = await publishDraft(draft.id);
      console.log(`  published → catalog book #${bookId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  publish failed: ${msg}`);
    }
  } else {
    console.log(`  already published — content updated`);
  }
}

console.log("\nDone.");
