import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { sql } from 'drizzle-orm';

// Check ALL grade/kindergarten curriculum books regardless of visibility
const rows = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.visible, b.source_draft_id,
         d.id AS draft_id, d.title AS draft_title, d.status,
         COALESCE(LENGTH(d.content), 0) AS content_len
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.title ILIKE '%grade%' OR b.title ILIKE '%kindergarten%'
  ORDER BY b.id
`) as any;

const allRows: any[] = rows.rows ?? [];
console.log(`Found ${allRows.length} grade/kindergarten books:\n`);

for (const r of allRows) {
  const hasDraft = !!r.draft_id;
  const titleMatch = hasDraft
    ? (r.book_title || '').toLowerCase().trim() === (r.draft_title || '').toLowerCase().trim()
    : null;
  const hasContent = r.content_len >= 100;

  let flag = '✅ OK';
  if (!hasDraft) flag = '❌ NO DRAFT';
  else if (!titleMatch) flag = `❌ WRONG DRAFT (#${r.draft_id} "${r.draft_title}")`;
  else if (!hasContent) flag = '⚠️  EMPTY CONTENT';

  const vis = r.visible ? 'visible' : 'HIDDEN';
  console.log(`  #${r.book_id} [${vis}] "${r.book_title}" — ${flag} (${r.content_len} chars)`);
}

// Also: check ALL books (not just grade/kinder) that are hidden and have empty content
const hiddenEmpty = await db.execute(sql`
  SELECT b.id, b.title, b.visible, b.source_draft_id,
         d.title AS draft_title,
         COALESCE(LENGTH(d.content), 0) AS content_len
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.visible = false
    AND (d.content IS NULL OR LENGTH(d.content) < 100)
  ORDER BY b.id
`) as any;

const hidden: any[] = hiddenEmpty.rows ?? [];
console.log(`\n── Hidden books with no/empty content: ${hidden.length} ──`);
for (const r of hidden) {
  const draftInfo = r.draft_title ? `draft "${r.draft_title}" [${r.content_len} chars]` : 'NO DRAFT';
  console.log(`  #${r.id} "${r.title}" — ${draftInfo}`);
}

process.exit(0);
