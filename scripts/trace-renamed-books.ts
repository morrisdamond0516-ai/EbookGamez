import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// 1. State of draft #31 "Cosmic Dread"
const d31 = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content),0) AS len,
         b.id AS book_id, b.title AS book_title, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.id = 31
`);
console.log('Draft #31:', JSON.stringify(d31.rows[0]));

// 2. Any book in dev with "cosmic" or "dread" in title
const cosmicBook = await db.execute(sql`
  SELECT b.id, b.title, b.visible, b.source_draft_id,
         d.id AS draft_id, d.title AS draft_title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE LOWER(b.title) LIKE '%cosmic%' OR LOWER(b.title) LIKE '%dread%'
`);
console.log('\nDev books with cosmic/dread:', JSON.stringify(cosmicBook.rows));

// 3. Production books with cosmic/dread
const liveRes = await fetch('https://EbookGamez.replit.app/api/books?limit=2000');
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
const cosmicLive = liveBooks.filter(b => (b.title||'').toLowerCase().includes('cosmic') || (b.title||'').toLowerCase().includes('dread'));
console.log('\nProduction books with cosmic/dread:', JSON.stringify(cosmicLive));

// 4. The replaced book slots (high-ID Cursor drafts 856-867 that replaced old dev books)
const replacedBooks = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title,
         d.id AS draft_id, d.title AS draft_title,
         COALESCE(LENGTH(d.content),0) AS content_len
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE d.id BETWEEN 856 AND 867
  ORDER BY b.id
`);
console.log('\nBooks replaced by Cursor sync (drafts 856-867):');
for (const r of replacedBooks.rows as any[]) {
  const match = (r.book_title||'').toLowerCase().trim() === (r.draft_title||'').toLowerCase().trim();
  console.log(`  Book #${r.book_id} "${r.book_title}" ← draft #${r.draft_id} "${r.draft_title}" ${match?'✅':'⚠️ MISMATCH'} [${Number(r.content_len).toLocaleString()} chars]`);
}

// 5. Any remaining book<->draft title mismatches across the whole table
const mismatches = await db.execute(sql`
  SELECT b.id, b.title AS book_title, b.visible,
         d.id AS draft_id, d.title AS draft_title,
         COALESCE(LENGTH(d.content),0) AS content_len
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE LOWER(TRIM(b.title)) != LOWER(TRIM(d.title))
  ORDER BY b.id
`);
console.log(`\nBook<->draft title mismatches (${mismatches.rows.length} total):`);
for (const r of mismatches.rows as any[]) {
  console.log(`  Book #${r.id} [vis:${r.visible}] "${r.book_title}" → draft #${r.draft_id} "${r.draft_title}" [${Number(r.content_len).toLocaleString()} chars]`);
}

// 6. The 29 demoted drafts — what do they look like now?
const demoted = await db.execute(sql`
  SELECT id, title, status FROM draft_ebooks
  WHERE id IN (20,31,34,36,37,52,97,139,146,148,149,153,162,164,165,172,183,186,195,215,217,221,227,230,250,252,258,265,606)
  ORDER BY id
`);
console.log('\n29 demoted drafts current status:');
for (const r of demoted.rows as any[]) console.log(`  Draft #${r.id} "${r.title}" [${r.status}]`);

process.exit(0);
