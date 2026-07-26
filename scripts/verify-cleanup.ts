import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Check if the old placeholder drafts are actually gone
const oldIds = [20,31,34,36,37,52,65,97,139,146,148,149,153,162,164,165,172,
  183,186,195,215,217,221,227,230,250,252,258,265,451,606,
  653,671,672,676,685,687,693,694];

const stillExist = await db.execute(sql`
  SELECT id, title, status FROM draft_ebooks
  WHERE id = ANY(ARRAY[20,31,34,36,37,52,65,97,139,146,148,149,153,162,164,165,172,
  183,186,195,215,217,221,227,230,250,252,258,265,451,606,
  653,671,672,676,685,687,693,694]::int[])
  ORDER BY id
`) as any;

console.log(`Old placeholder drafts still in DB: ${stillExist.rows.length}`);
for (const r of stillExist.rows as any[]) {
  console.log(`  Draft #${r.id} "${r.title}" [${r.status}]`);
}

// All published orphans (no book linked)
const publishedOrphans = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content),0) AS len
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL AND d.status = 'published'
  ORDER BY d.id
`) as any;

console.log(`\nAll published orphan drafts (no book linked): ${publishedOrphans.rows.length}`);
for (const r of publishedOrphans.rows as any[]) {
  console.log(`  Draft #${r.id} "${r.title}" [${Number(r.len).toLocaleString()} chars]`);
}

// Overall counts
const counts = await db.execute(sql`
  SELECT status, COUNT(*) AS cnt FROM draft_ebooks GROUP BY status ORDER BY status
`) as any;
console.log('\nDraft counts by status:');
for (const r of counts.rows as any[]) console.log(`  ${r.status}: ${r.cnt}`);

process.exit(0);
