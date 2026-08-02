import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Check the two mismatched drafts
const drafts = await db.execute(sql`
  SELECT d.id, d.title, d.status, d.cover_url,
         LENGTH(d.content) AS len,
         SUBSTRING(d.content, 1, 300) AS content_preview,
         b.id AS book_id, b.title AS book_title, b.cover_url AS book_cover
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.id IN (744, 774)
  ORDER BY d.id
`) as any;

for (const r of drafts.rows as any[]) {
  console.log(`\n=== Draft #${r.id} ===`);
  console.log(`Title:      ${r.title}`);
  console.log(`Status:     ${r.status}`);
  console.log(`Cover URL:  ${r.cover_url}`);
  console.log(`Content:    ${Number(r.len).toLocaleString()} chars`);
  console.log(`Content preview: ${r.content_preview?.substring(0,200)}`);
  console.log(`Linked book: ${r.book_id ? `#${r.book_id} "${r.book_title}"` : 'NONE'}`);
}

// Find "The Dragon Academy Trials" and "Readathon Rivals on Paper Street"
const related = await db.execute(sql`
  SELECT id, title, source_draft_id, cover_url FROM books
  WHERE title ILIKE '%dragon academy%' OR title ILIKE '%readathon%' OR title ILIKE '%paper street%'
  ORDER BY id
`) as any;
console.log(`\n\nBooks matching those cover titles:`);
for (const r of related.rows as any[]) {
  console.log(`  Book #${r.id} "${r.title}" — draft #${r.source_draft_id}`);
}

// Also check which books those cover URLs actually belong to
const d744cover = (drafts.rows as any[]).find((r:any) => r.id === 744)?.cover_url;
const d774cover = (drafts.rows as any[]).find((r:any) => r.id === 774)?.cover_url;

if (d744cover) {
  const match744 = await db.execute(sql`
    SELECT id, title, source_draft_id FROM books WHERE cover_url = ${d744cover} LIMIT 5
  `) as any;
  console.log(`\nBooks using draft #744's cover (${d744cover?.substring(0,60)}...):`);
  for (const r of match744.rows as any[]) console.log(`  Book #${r.id} "${r.title}"`);

  const draftMatch744 = await db.execute(sql`
    SELECT id, title FROM draft_ebooks WHERE cover_url = ${d744cover} AND id != 744 LIMIT 5
  `) as any;
  for (const r of draftMatch744.rows as any[]) console.log(`  Draft #${r.id} "${r.title}"`);
}

if (d774cover) {
  const match774 = await db.execute(sql`
    SELECT id, title, source_draft_id FROM books WHERE cover_url = ${d774cover} LIMIT 5
  `) as any;
  console.log(`\nBooks using draft #774's cover (${d774cover?.substring(0,60)}...):`);
  for (const r of match774.rows as any[]) console.log(`  Book #${r.id} "${r.title}"`);

  const draftMatch774 = await db.execute(sql`
    SELECT id, title FROM draft_ebooks WHERE cover_url = ${d774cover} AND id != 774 LIMIT 5
  `) as any;
  for (const r of draftMatch774.rows as any[]) console.log(`  Draft #${r.id} "${r.title}"`);
}

process.exit(0);
