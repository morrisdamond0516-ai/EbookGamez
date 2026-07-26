import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// The 16 renamed books from Cursor's list
const renamedIds = [17,19,20,35,74,104,156,169,173,279,287,295,325,357,391,397];

const rows = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.visible,
         b.cover_url AS book_cover,
         d.id AS draft_id, d.title AS draft_title, d.status AS draft_status,
         COALESCE(LENGTH(d.content),0) AS content_len,
         d.cover_url AS draft_cover
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.id = ANY(ARRAY[17,19,20,35,74,104,156,169,173,279,287,295,325,357,391,397]::int[])
  ORDER BY b.id
`) as any;

console.log('State of all 16 renamed books:\n');
let problems = 0;
for (const r of (rows.rows as any[])) {
  const issues: string[] = [];
  if (r.draft_status !== 'published') issues.push(`draft is '${r.draft_status}' not 'published'`);
  if (!r.draft_cover && !r.book_cover) issues.push('NO COVER');
  if (r.content_len < 100) issues.push('NO CONTENT');
  if ((r.book_title||'').toLowerCase() !== (r.draft_title||'').toLowerCase()) issues.push(`title mismatch: book="${r.book_title}" draft="${r.draft_title}"`);

  const status = issues.length ? `❌ ${issues.join(', ')}` : '✅';
  if (issues.length) problems++;
  console.log(`Book #${r.book_id} "${r.book_title?.slice(0,50)}"`);
  console.log(`  Draft #${r.draft_id} [${r.draft_status}] ${r.content_len.toLocaleString()} chars`);
  console.log(`  Book cover:  ${r.book_cover ? r.book_cover.slice(0,60) : 'NONE'}`);
  console.log(`  Draft cover: ${r.draft_cover ? r.draft_cover.slice(0,60) : 'NONE'}`);
  console.log(`  ${status}\n`);
}

// Also check the demoted old drafts — confirm none are still linked to these books
const oldDraftIds = [31,20,34,36,37,52,97,139,146,148,149,153,162,164,165,172,183,186,195,215,217,221,227,230,250,252,258,265,606];
const stillLinked = await db.execute(sql`
  SELECT b.id AS book_id, b.title, d.id AS draft_id, d.title AS draft_title, d.status
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE d.id = ANY(ARRAY[31,20,34,36,37,52,97,139,146,148,149,153,162,164,165,172,183,186,195,215,217,221,227,230,250,252,258,265,606]::int[])
`) as any;
console.log(`\nOld demoted drafts still linked to active books: ${stillLinked.rows.length}`);
for (const r of (stillLinked.rows as any[])) {
  console.log(`  ❌ Book #${r.book_id} "${r.title}" still links to demoted draft #${r.draft_id} "${r.draft_title}" [${r.status}]`);
}
console.log(`\nTotal problems: ${problems}`);
process.exit(0);
