/**
 * Sync catalog for a draft that already had title+cover repaired but publish threw
 * because status was already "published".
 *   node script/run-tsx.mjs script/sync-published-title-repair.ts 215
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  findCatalogBookForDraft,
  getCatalogDescriptionFromDraft,
} from "../server/contentStudio";

async function main() {
  const draftId = parseInt(process.argv[2] || "", 10);
  if (!draftId) {
    console.error("Usage: sync-published-title-repair.ts <draftId>");
    process.exit(1);
  }
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!d) throw new Error(`Draft #${draftId} not found`);
  if (!d.title) throw new Error(`Draft #${draftId} has no title`);

  const cover = d.coverUrl || d.backgroundUrl || null;
  const catalog =
    (await findCatalogBookForDraft(draftId, d.title)) ||
    (await findCatalogBookForDraft(draftId, null));
  const desc = getCatalogDescriptionFromDraft(d.description, d.title);

  console.log(`Draft #${draftId}: "${d.title}" cover=${!!cover} status=${d.status}`);
  if (catalog) {
    await db
      .update(books)
      .set({
        title: d.title,
        coverUrl: cover || undefined,
        description: desc || undefined,
        sourceDraftId: draftId,
      })
      .where(eq(books.id, catalog.id));
    console.log(`Synced catalog book #${catalog.id}`);
  } else {
    console.log("No linked catalog row via sourceDraftId");
  }

  // Also fix any leftover old collision titles if provided as extra args
  for (const oldTitle of process.argv.slice(3)) {
    const updated = await db
      .update(books)
      .set({
        title: d.title,
        coverUrl: cover || undefined,
        description: desc,
      })
      .where(sql`LOWER(TRIM(${books.title})) = LOWER(TRIM(${oldTitle}))`)
      .returning({ id: books.id });
    if (updated.length) {
      console.log(`Updated old-title rows ${updated.map((r) => r.id).join(",")} from "${oldTitle}"`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
