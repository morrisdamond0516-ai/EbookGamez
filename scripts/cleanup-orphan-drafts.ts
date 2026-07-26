/**
 * Clean up orphan published drafts whose titles no longer match any production book.
 *
 * Groups:
 *   - OLD PLACEHOLDERS: titles that existed only in dev (replaced by production books).
 *     → demote to status='draft' so they stop showing in the published view.
 *   - PENDING NEW (739-784): Cursor-written books awaiting push. Leave alone.
 *   - OTHER ORPHANS (65,451,606,653+): check against production; decide per case.
 */
import { db } from '../server/storage';
import { draftEbooks } from '../shared/schema';
import { sql, eq, inArray } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';
const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[ DRY RUN ]\n');

// Fetch live book titles for cross-reference
const liveRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
const liveTitles = new Set(liveBooks.map((b: any) => (b.title||'').toLowerCase().trim()));

// Get all orphan published drafts (no book linked)
const orphanRows = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content),0) AS content_len
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL AND d.status = 'published'
  ORDER BY d.id
`) as any;
const orphans: any[] = orphanRows.rows ?? [];

// Pending new books (739-784): Cursor-written, awaiting push — leave alone
const PENDING_NEW = new Set([739,740,741,742,744,774,775,776,777,778,779,780,781,782,783,784]);

// Classify each orphan
const toDeactivate: number[] = [];   // old placeholders — demote to draft
const onLive: any[] = [];            // orphan but title IS on production (investigate)
const pendingNew: any[] = [];        // leave alone
const other: any[] = [];             // everything else

for (const r of orphans) {
  if (PENDING_NEW.has(r.id)) { pendingNew.push(r); continue; }
  const onProd = liveTitles.has((r.title||'').toLowerCase().trim());
  if (onProd) { onLive.push(r); continue; }
  // Not on production and not a pending new book → old placeholder, deactivate
  toDeactivate.push(r.id);
  other.push(r);
}

console.log(`Total orphan published drafts: ${orphans.length}`);
console.log(`  → Old placeholders to demote: ${toDeactivate.length}`);
console.log(`  → Pending new (leave alone):  ${pendingNew.length}`);
console.log(`  → Orphan but ON production:   ${onLive.length}`);
console.log('');

if (onLive.length > 0) {
  console.log('⚠️  These orphan drafts have titles that exist on production — they may need relinking:');
  onLive.forEach((r: any) => console.log(`   Draft #${r.id} "${r.title}" [${r.content_len} chars]`));
  console.log('');
}

console.log('Old placeholder drafts being demoted to "draft" status:');
other.forEach((r: any) => console.log(`  Draft #${r.id} "${r.title}" [${r.content_len} chars]`));

if (!DRY_RUN && toDeactivate.length > 0) {
  // Demote in batches
  const placeholders = toDeactivate.map((_, i) => `$${i + 2}`).join(',');
  await db.execute(
    sql.raw(`UPDATE draft_ebooks SET status = 'draft' WHERE id IN (${toDeactivate.join(',')})`)
  );
  console.log(`\n✅ Demoted ${toDeactivate.length} old placeholder drafts to 'draft' status.`);
  console.log('They are now hidden from the published view in Content Studio.');
}

// Summary of what remains in published view
const remaining = await db.execute(sql`
  SELECT COUNT(*) FILTER (WHERE status = 'published') AS published,
         COUNT(*) FILTER (WHERE status = 'draft') AS draft
  FROM draft_ebooks
`) as any;
const rem = remaining.rows[0];
console.log(`\nContent Studio published drafts: ${rem.published} | draft: ${rem.draft}`);
process.exit(0);
