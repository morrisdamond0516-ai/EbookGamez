/**
 * Remove empty duplicate instructional chrome shells (## Practice above ### Practice A, etc.)
 * and flag truly empty Example/Practice sections.
 *
 *   npx tsx --import ./script/load-env.ts script/repair-empty-instructional-sections.ts
 *   npx tsx --import ./script/load-env.ts script/repair-empty-instructional-sections.ts 740 729 --apply
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq, inArray, or, ilike } from "drizzle-orm";
import {
  repairEmptyInstructionalSections,
  scanEmptyInstructionalSections,
  isEducationalDraft,
} from "../shared/educationalBookQuality";

const apply = process.argv.includes("--apply");
const argIds = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => parseInt(a, 10))
  .filter((n) => !Number.isNaN(n));

let drafts = argIds.length
  ? await db.select().from(draftEbooks).where(inArray(draftEbooks.id, argIds))
  : await db
      .select()
      .from(draftEbooks)
      .where(
        or(
          ilike(draftEbooks.title, "%Complete School Year%"),
          ilike(draftEbooks.description, "%Schoolbooks Catalog%"),
        ),
      );

drafts = drafts.filter((d) => isEducationalDraft({ genre: d.genre, description: d.description }));

console.log(`${apply ? "APPLY" : "DRY-RUN"} — ${drafts.length} schoolbook draft(s)`);

let totalRemoved = 0;
for (const d of drafts.sort((a, b) => a.id - b.id)) {
  const before = scanEmptyInstructionalSections(d.content || "");
  const repaired = repairEmptyInstructionalSections(d.content || "");
  const after = scanEmptyInstructionalSections(repaired.content);
  if (repaired.removed === 0 && before.details.length === 0) continue;
  console.log(
    `#${d.id} ${d.title?.slice(0, 50)} shells=${before.details.filter((x) => x.reason === "duplicate-shell").length} empty=${before.details.filter((x) => x.reason === "empty-body").length} → remove ${repaired.removed}, remaining empty=${after.details.filter((x) => x.reason === "empty-body").length}`,
  );
  for (const s of repaired.details.slice(0, 6)) console.log("  ", s);
  if (apply && repaired.removed > 0) {
    await db.update(draftEbooks).set({ content: repaired.content }).where(eq(draftEbooks.id, d.id));
    totalRemoved += repaired.removed;
  }
}

console.log(apply ? `Done. Removed ${totalRemoved} shell header(s).` : "Dry-run only. Pass --apply to write.");
process.exit(0);
