import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Get first 500 and last 500 chars of each draft to compare
const rows = await db.execute(sql`
  SELECT id, title, status,
         COALESCE(LENGTH(content), 0) AS char_count,
         LEFT(content, 500) AS head,
         RIGHT(content, 200) AS tail
  FROM draft_ebooks
  WHERE id IN (31, 865)
  ORDER BY id
`) as any;

for (const r of (rows.rows as any[])) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Draft #${r.id} "${r.title}" [${r.status}] — ${Number(r.char_count).toLocaleString()} chars`);
  console.log(`HEAD:\n${r.head}`);
  console.log(`TAIL:\n${r.tail}`);
}

// Check if the heads match (same manuscript?)
const [d31, d865] = rows.rows as any[];
const sameHead = (d31?.head || '').slice(50, 200).trim() === (d865?.head || '').slice(50, 200).trim();
console.log(`\n\nSame content (head comparison): ${sameHead ? '⚠️  YES — same manuscript' : '✅ NO — different content'}`);

// Also: what was the original book ID that draft #31 belonged to?
// Check git history or look at which book IDs were in the 8,15,17... range
// by seeing which books now link to high-ID drafts (856-867) and inferring the old draft
const replacedSlots = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title,
         d.id AS draft_id, d.title AS draft_title
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.id IN (8,15,17,19,20,35,74,104,156,169,173,589)
  ORDER BY b.id
`) as any;

console.log('\nCurrent state of the 12 replaced book slots:');
for (const r of (replacedSlots.rows as any[])) {
  console.log(`  Book #${r.book_id} "${r.book_title?.slice(0,50)}" → draft #${r.draft_id}`);
}

// Check: is draft #31 "Cosmic Dread" content the same as any of the new drafts?
// Quick hash: compare first 300 chars of draft #31 against all new drafts 856-867
const newDrafts = await db.execute(sql`
  SELECT id, title, LEFT(content, 300) AS head
  FROM draft_ebooks
  WHERE id BETWEEN 856 AND 867
`) as any;

const cosmicHead = (d31?.head || '').slice(0, 300).trim();
console.log('\nContent similarity check — draft #31 "Cosmic Dread" vs new drafts:');
for (const nd of (newDrafts.rows as any[])) {
  const ndHead = (nd.head || '').slice(0, 300).trim();
  const match = cosmicHead.length > 50 && ndHead.length > 50 && cosmicHead.slice(20,100) === ndHead.slice(20,100);
  if (match) console.log(`  ⚠️  SAME CONTENT: draft #${nd.id} "${nd.title}"`);
}
console.log('  (done — no output above means no match found)');

process.exit(0);
