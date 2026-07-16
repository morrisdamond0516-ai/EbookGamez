/**
 * Replace ONE bad illustration in Luna (#724), quality check, publish.
 *
 *   npm run fix:luna-image
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  resolveOneIllustrationMarker,
  publishDraft,
  getVisualPublishBlockers,
  checkIllustrationQuality,
} from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";

const DRAFT_ID = 724;
const WINDOW_CAPTION =
  "Close-up view through Luna's bedroom window blinds from inside the room";

const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, DRAFT_ID));
if (!draft?.content) throw new Error("Draft 724 not found");

let content = draft.content;
const genre = draft.genre || "Children's Fiction";
const title = draft.title || "Luna and the Starwhale";

// Re-insert missing window marker between bedroom wide shot and Marisol doorway (if stripped).
const afterBedroom = /(\[ILLUSTRATION:[^\]]*illust-1783575913314-0\.png[^\]]*\])(\s*)(\[ILLUSTRATION:[^\]]*illust-1783575965402-1\.png)/;
if (!content.includes(WINDOW_CAPTION) && afterBedroom.test(content)) {
  content = content.replace(
    afterBedroom,
    `$1\n\n[ILLUSTRATION: ${WINDOW_CAPTION}]\n\n$3`,
  );
  console.log("Re-inserted missing window-blinds illustration marker.");
  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, DRAFT_ID));
} else if (content.match(/illust-1783576014355-2\.png/)) {
  // Legacy bad file still present — swap caption to pending for regen.
  content = content.replace(
    /\[ILLUSTRATION:\s*[^\]]*illust-1783576014355-2\.png[^\]]*\]/i,
    `[ILLUSTRATION: ${WINDOW_CAPTION}]`,
  );
  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, DRAFT_ID));
  console.log("Reset bad telescope image marker to pending.");
}

if (!content.includes(`[ILLUSTRATION: ${WINDOW_CAPTION}]`) && !content.includes(WINDOW_CAPTION)) {
  throw new Error("Window blinds marker not found and could not be re-inserted.");
}

console.log("Generating replacement window illustration...");
const { content: updated, filename } = await resolveOneIllustrationMarker(
  content,
  WINDOW_CAPTION,
  genre,
  title,
  DRAFT_ID,
);
console.log(`New image: ${filename}`);

const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, DRAFT_ID));
const finalContent = updated || fresh.content || "";

const visualBlockers = getVisualPublishBlockers(finalContent, genre);
if (visualBlockers.length > 0) {
  console.error("Visual publish blockers:", visualBlockers.join("; "));
  process.exit(1);
}

const chapterMatches = [...finalContent.matchAll(/##\s*Chapter\s+(\d+)/gi)];
const illQ = checkIllustrationQuality(finalContent, chapterMatches, genre, fresh.outline);
console.log("Illustration quality check:");
for (const issue of illQ.issues) console.log(`  - ${issue}`);
if (illQ.hasBlockingIssues) {
  console.log("(Structural illustration warnings present — publish uses visual blockers only.)");
}

if (!draftHasPublishableCover(fresh)) {
  console.error("Cover missing.");
  process.exit(1);
}

if (fresh.status === "published") {
  console.log("Already published — content updated with new window image.");
} else {
  const bookId = await publishDraft(DRAFT_ID);
  console.log(`Published → catalog book #${bookId}`);
}
