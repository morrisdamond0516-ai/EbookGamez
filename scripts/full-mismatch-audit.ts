import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// 1. Verify the 4 whose cover match wasn't found — find their real drafts
const missingCover = [739, 741, 742];
console.log('=== Verifying the 3 with no cover match found ===\n');
for (const id of missingCover) {
  const d = await db.execute(sql`
    SELECT id, title, cover_url, SUBSTRING(content, 1, 100) AS preview FROM draft_ebooks WHERE id = ${id}
  `) as any;
  const row = d.rows[0] as any;
  const contentTitle = (row.preview as string)?.match(/^#\s+(.+)/m)?.[1] ?? '';

  // Find by content title
  const byTitle = await db.execute(sql`
    SELECT 'book' AS kind, id::text, title FROM books WHERE title ILIKE ${contentTitle}
    UNION ALL
    SELECT 'draft' AS kind, id::text, title FROM draft_ebooks WHERE title ILIKE ${contentTitle} AND id != ${id}
    LIMIT 5
  `) as any;

  console.log(`Draft #${id} "${row.title}" — content says "${contentTitle}"`);
  if (byTitle.rows.length > 0) {
    for (const m of byTitle.rows as any[]) console.log(`  Real entry: ${m.kind} #${m.id} "${m.title}"`);
  } else {
    console.log(`  ⚠️  No matching book or draft found for "${contentTitle}"`);
  }
}

// 2. Full audit: every published draft — check if content H1 matches the draft title
console.log('\n\n=== Full published-draft mismatch audit ===\n');
const all = await db.execute(sql`
  SELECT d.id, d.title, d.status,
         SUBSTRING(d.content, 1, 200) AS preview,
         b.id AS book_id
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.status = 'published'
  ORDER BY d.id
`) as any;

const mismatches: any[] = [];
for (const r of all.rows as any[]) {
  const contentTitle = (r.preview as string)?.match(/^#\s+(.+)/m)?.[1]?.trim() ?? '';
  const draftTitle = (r.title as string).trim();
  if (contentTitle && contentTitle.toLowerCase() !== draftTitle.toLowerCase()) {
    mismatches.push({ id: r.id, draftTitle, contentTitle, bookId: r.book_id });
  }
}

if (mismatches.length === 0) {
  console.log('✅ No mismatches found outside the known 16 orphans.');
} else {
  console.log(`Found ${mismatches.length} title/content mismatches:\n`);
  for (const m of mismatches) {
    const linked = m.bookId ? `→ book #${m.bookId}` : 'NO BOOK';
    console.log(`  Draft #${m.id} [${linked}] titled "${m.draftTitle}" but content says "${m.contentTitle}"`);
  }
}

process.exit(0);
