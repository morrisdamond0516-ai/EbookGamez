/**
 * Restore cover for a draft with atmospheric-cinema style.
 * Usage: npx tsx --import ./script/load-env.ts script/restore-cover-atmospheric.ts [draftId]
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import { regenerateSelectedBackgrounds } from "../server/contentStudio";

const draftId = parseInt(process.argv[2] || "729", 10);
if (!Number.isFinite(draftId)) {
  console.error("Usage: restore-cover-atmospheric.ts <draftId>");
  process.exit(1);
}

const [before] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
if (!before) {
  console.error(`Draft #${draftId} not found`);
  process.exit(1);
}

console.log("Before:", {
  id: before.id,
  title: before.title,
  genre: before.genre,
  coverUrl: before.coverUrl,
  backgroundUrl: before.backgroundUrl,
  coverStyleId: before.coverStyleId,
});

console.log(`\nRegenerating #${draftId} with atmospheric-cinema...`);
const result = await regenerateSelectedBackgrounds(
  [draftId],
  "atmospheric-cinema",
  false,
  (current, total, title, ok, err) => {
    console.log(`[${current}/${total}] ${ok ? "OK" : "FAIL"} ${title}${err ? ` — ${err}` : ""}`);
  },
);

console.log("\nResult:", result);

const [after] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
console.log("After:", {
  id: after?.id,
  title: after?.title,
  coverUrl: after?.coverUrl,
  backgroundUrl: after?.backgroundUrl,
  coverStyleId: after?.coverStyleId,
});

process.exit(result.generated > 0 ? 0 : 1);
