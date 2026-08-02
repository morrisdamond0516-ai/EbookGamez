import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const ids = [739, 741, 742];

for (const id of ids) {
  // Get the full content length, first 500 chars, and a chunk from the middle
  const d = await db.execute(sql`
    SELECT id, title,
           LENGTH(content) AS len,
           SUBSTRING(content, 1, 600) AS head,
           SUBSTRING(content, 2000, 400) AS mid
    FROM draft_ebooks WHERE id = ${id}
  `) as any;
  const row = d.rows[0] as any;
  const contentTitle = (row.head as string)?.match(/^#\s+(.+)/m)?.[1]?.trim() ?? '';
  const len = Number(row.len);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Draft #${id} — draft title: "${row.title}"`);
  console.log(`Content title (H1): "${contentTitle}"`);
  console.log(`Content length: ${len.toLocaleString()} chars`);

  // 1. Search by content title across books and drafts
  const byTitle = await db.execute(sql`
    SELECT 'book' AS kind, id::text, title, NULL AS content_len FROM books WHERE title ILIKE ${`%${contentTitle}%`}
    UNION ALL
    SELECT 'draft', id::text, title, LENGTH(content)::text FROM draft_ebooks WHERE title ILIKE ${`%${contentTitle}%`} AND id != ${id}
  `) as any;

  // 2. Search by content length (within 5% tolerance) — might share length with same book
  const byLen = await db.execute(sql`
    SELECT id, title, LENGTH(content) AS dlen
    FROM draft_ebooks
    WHERE id != ${id}
      AND LENGTH(content) BETWEEN ${Math.floor(len * 0.95)} AND ${Math.ceil(len * 1.05)}
    ORDER BY ABS(LENGTH(content) - ${len})
    LIMIT 5
  `) as any;

  // 3. Extract a unique phrase from the content (lines 3-5) and search for it
  const lines = (row.head as string).split('\n').filter((l: string) => l.trim().length > 30).slice(1, 3);
  const phrase = lines[0]?.trim().substring(0, 60) ?? '';
  let phraseMatches: any[] = [];
  if (phrase) {
    const pm = await db.execute(sql`
      SELECT id, title FROM draft_ebooks
      WHERE id != ${id} AND content ILIKE ${`%${phrase}%`}
      LIMIT 5
    `) as any;
    phraseMatches = pm.rows as any[];
  }

  // Results
  if (byTitle.rows.length > 0) {
    console.log(`\n  By title match:`);
    for (const m of byTitle.rows as any[]) console.log(`    ${m.kind} #${m.id} "${m.title}" [${m.content_len ?? '?'} chars]`);
  } else {
    console.log(`\n  By title: no other book/draft has this title`);
  }

  if (byLen.rows.length > 0) {
    console.log(`  By length (~${len.toLocaleString()} chars ±5%):`);
    for (const m of byLen.rows as any[]) console.log(`    Draft #${m.id} "${m.title}" [${Number(m.dlen).toLocaleString()} chars]`);
  } else {
    console.log(`  By length: no near-match`);
  }

  if (phraseMatches.length > 0) {
    console.log(`  By phrase ("${phrase}"...):`);
    for (const m of phraseMatches) console.log(`    Draft #${m.id} "${m.title}"`);
  } else {
    console.log(`  By phrase ("${phrase}"...): not found in any other draft`);
  }

  const duplicate = byTitle.rows.length > 0 || phraseMatches.length > 0;
  console.log(`\n  VERDICT: ${duplicate ? '⚠️  POSSIBLE DUPLICATE — content exists elsewhere' : '✅ UNIQUE — no match found anywhere in the database'}`);
}

process.exit(0);
