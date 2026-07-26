import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Search broadly for any "grade 1" or "first grade" math book
const rows = await db.execute(sql`
  SELECT b.id, b.title, b.visible, b.source_draft_id,
         d.title AS draft_title, d.status,
         COALESCE(LENGTH(d.content), 0) AS content_len
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.title ILIKE '%grade 1%math%'
     OR b.title ILIKE '%math%grade 1%'
     OR b.title ILIKE '%first grade%math%'
     OR b.title ILIKE '%grade one%math%'
  ORDER BY b.id
`) as any;

console.log(`Grade 1 Math search results: ${rows.rows.length}`);
rows.rows.forEach((r: any) => {
  const ok = r.content_len >= 100 && r.draft_title?.toLowerCase().trim() === r.title?.toLowerCase().trim();
  console.log(`  #${r.id} [visible:${r.visible}] "${r.title}"`);
  console.log(`    draft #${r.source_draft_id} "${r.draft_title}" [${r.status}, ${r.content_len} chars] ${ok ? '✅' : '❌'}`);
});

// Also show all drafts with "grade 1" in title to find orphaned ones
const drafts = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content), 0) AS content_len,
         b.id AS book_id, b.title AS book_title, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.title ILIKE '%grade 1%math%' OR d.title ILIKE '%math%grade 1%'
  ORDER BY d.id
`) as any;

console.log(`\nDraft records with "Grade 1 Math": ${drafts.rows.length}`);
drafts.rows.forEach((r: any) => {
  const linked = r.book_id ? `→ Book #${r.book_id} "${r.book_title}" [visible:${r.visible}]` : '→ NO BOOK LINKED (orphan)';
  console.log(`  Draft #${r.id} "${r.title}" [${r.status}, ${r.content_len} chars] ${linked}`);
});

// Also check production
const liveUrl = 'https://EbookGamez.replit.app';
const liveRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
const liveMath1 = liveBooks.filter((b: any) =>
  /grade.?1.+math|math.+grade.?1|first.?grade.+math/i.test(b.title || '')
);
console.log(`\nProduction books matching "Grade 1 Math": ${liveMath1.length}`);
liveMath1.forEach((b: any) => console.log(`  #${b.id} "${b.title}" [visible:${b.visible}]`));

process.exit(0);
