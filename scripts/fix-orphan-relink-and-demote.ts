/**
 * Demote all published orphan drafts to status='draft'.
 * Pending new books (739-784) are left untouched.
 * The 10 "on production" orphans are genuine content duplicates —
 * their matching books already link to equivalent drafts, so no relinking needed.
 */
import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const PENDING_NEW = new Set([739,740,741,742,744,774,775,776,777,778,779,780,781,782,783,784]);
const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[ DRY RUN ]\n');

// All published orphans (no book linked)
const orphanRows = await db.execute(sql`
  SELECT d.id, d.title, COALESCE(LENGTH(d.content),0) AS content_len
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL AND d.status = 'published'
  ORDER BY d.id
`) as any;

const toDemote = (orphanRows.rows as any[])
  .filter(r => !PENDING_NEW.has(r.id))
  .map(r => r.id);

console.log(`Orphan published drafts to demote: ${toDemote.length}`);
console.log(`(Pending new books left alone: ${PENDING_NEW.size})\n`);

if (!DRY_RUN && toDemote.length > 0) {
  await db.execute(sql.raw(
    `UPDATE draft_ebooks SET status = 'draft' WHERE id IN (${toDemote.join(',')})`
  ));
  console.log(`✅ Demoted ${toDemote.length} orphan drafts to 'draft' status.`);
}

// Verify
const after = await db.execute(sql`
  SELECT
    COUNT(*) FILTER (WHERE status = 'published') AS published,
    COUNT(*) FILTER (WHERE status = 'draft')     AS draft,
    COUNT(*) FILTER (WHERE status = 'published' AND id NOT IN (
      SELECT COALESCE(source_draft_id, 0) FROM books
    )) AS published_orphan_remaining
  FROM draft_ebooks
`) as any;
const a = after.rows[0];
console.log(`\nContent Studio state after fix:`);
console.log(`  Published:               ${a.published}`);
console.log(`  Draft (hidden):          ${a.draft}`);
console.log(`  Published orphans left:  ${a.published_orphan_remaining} (should be 16 pending-new only)`);
process.exit(0);
