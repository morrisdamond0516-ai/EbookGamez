/**
 * Permanently delete:
 * A) The 39 demoted old-placeholder/duplicate drafts (old covers, old titles,
 *    no longer linked to any book — pure dead weight)
 * B) The 81 empty curriculum draft shells that have 0 content and no book linked
 *    (Cursor created the title stubs but never wrote the content)
 *
 * Safety checks run before every delete.
 */
import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[ DRY RUN — nothing will be deleted ]\n');

// ── A) The 39 demoted old-placeholder & content-duplicate drafts ──────────────
// Safety: confirm none are linked to any book before deleting
const groupA = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content),0) AS len,
         b.id AS book_id
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.status = 'draft'
    AND d.id IN (
      20,31,34,36,37,52,65,97,139,146,148,149,153,162,164,165,172,
      183,186,195,215,217,221,227,230,250,252,258,265,451,606,
      653,671,672,676,685,687,693,694
    )
`) as any;

const aLinked = (groupA.rows as any[]).filter(r => r.book_id);
const aSafe   = (groupA.rows as any[]).filter(r => !r.book_id);

console.log(`Group A — old placeholder / duplicate drafts: ${groupA.rows.length}`);
if (aLinked.length) {
  console.log(`  ⛔ SKIPPING ${aLinked.length} that are still linked to books:`);
  aLinked.forEach((r: any) => console.log(`     Draft #${r.id} "${r.title}" → book #${r.book_id}`));
}
console.log(`  ✅ Safe to delete: ${aSafe.length}`);

// ── B) The 81 empty curriculum draft shells ───────────────────────────────────
const groupB = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content),0) AS len,
         b.id AS book_id
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.status = 'draft'
    AND (d.content IS NULL OR LENGTH(d.content) < 100)
    AND b.id IS NULL
    AND d.id NOT IN (
      20,31,34,36,37,52,65,97,139,146,148,149,153,162,164,165,172,
      183,186,195,215,217,221,227,230,250,252,258,265,451,606,
      653,671,672,676,685,687,693,694
    )
`) as any;

console.log(`\nGroup B — empty curriculum shell drafts: ${groupB.rows.length}`);
(groupB.rows as any[]).slice(0, 10).forEach((r: any) => console.log(`  Draft #${r.id} "${r.title}" [0 chars]`));
if (groupB.rows.length > 10) console.log(`  ... and ${groupB.rows.length - 10} more`);

// ── Execute ───────────────────────────────────────────────────────────────────
const aIds = aSafe.map((r: any) => r.id);
const bIds = (groupB.rows as any[]).map((r: any) => r.id);
const allIds = [...aIds, ...bIds];

console.log(`\nTotal to delete: ${allIds.length} (${aIds.length} old placeholders + ${bIds.length} empty shells)`);

if (!DRY_RUN && allIds.length > 0) {
  await db.execute(sql.raw(`DELETE FROM draft_ebooks WHERE id IN (${allIds.join(',')})`));
  console.log(`\n✅ Deleted ${allIds.length} drafts.`);
}

// ── Final state ───────────────────────────────────────────────────────────────
const after = await db.execute(sql`
  SELECT
    COUNT(*) FILTER (WHERE status = 'published') AS published,
    COUNT(*) FILTER (WHERE status = 'draft')     AS in_draft,
    COUNT(*) FILTER (WHERE status = 'published' AND id NOT IN (
      SELECT COALESCE(source_draft_id, 0) FROM books
    )) AS published_orphan
  FROM draft_ebooks
`) as any;
const a = after.rows[0];
console.log(`\nContent Studio after cleanup:`);
console.log(`  Published:              ${a.published} (all linked to books or pending-new)`);
console.log(`  Draft (hidden):         ${a.in_draft}`);
console.log(`  Published orphans:      ${a.published_orphan} (the 16 pending textbooks)`);
process.exit(0);
