/**
 * Strip batch-repair fake [ILLUSTRATION:] wrappers from planner drafts.
 * Planners never use interior AI art — these markers are worksheet lines mis-tagged.
 *
 *   npm run repair:planner-markers
 *   npm run repair:planner-markers -- --dry-run
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import {
  unwrapNonImageIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
  getActivityBookPublishBlockers,
} from "../shared/activityBookContent";

const dryRun = process.argv.includes("--dry-run");

const rows = await db
  .select()
  .from(draftEbooks)
  .where(sql`${draftEbooks.genre} ILIKE '%planner%'`);

let updated = 0;
for (const d of rows) {
  const before = d.content || "";
  const { content, removed } = unwrapNonImageIllustrationMarkers(before);
  if (removed === 0 && content === before) continue;

  const pendingAfter = countUnprocessedIllustrationMarkers(content);
  const blockers = getActivityBookPublishBlockers(content, d.genre);

  console.log(
    `#${d.id} [${d.status}] stripped=${removed} pending_after=${pendingAfter} blockers=${blockers.length} — ${(d.title || "").slice(0, 50)}`,
  );

  if (!dryRun) {
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, d.id));
    updated++;
  }
}

console.log(
  dryRun
    ? `[dry-run] Would update ${rows.filter((d) => unwrapNonImageIllustrationMarkers(d.content || "").removed > 0).length} planner(s)`
    : `Updated ${updated} planner draft(s)`,
);
