/**
 * Deep diff: find every book that exists in production but NOT in dev (by title),
 * and every book that exists in dev but NOT in production (by title).
 * Also find all orphan drafts (draft exists, no book linked).
 */
import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

const liveBooksRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveBooksData = await liveBooksRes.json() as any;
const liveBooks: any[] = Array.isArray(liveBooksData) ? liveBooksData : (liveBooksData.books ?? []);

const localRows = await db.execute(sql`SELECT id, title FROM books ORDER BY id`) as any;
const localBooks: any[] = localRows.rows ?? [];

const liveByTitle = new Map(liveBooks.map((b: any) => [(b.title || '').toLowerCase().trim(), b]));
const localByTitle = new Map(localBooks.map((r: any) => [(r.title || '').toLowerCase().trim(), r]));

// Books in production not in dev (by title)
const onlyInProd = liveBooks.filter((b: any) => !localByTitle.has((b.title || '').toLowerCase().trim()));

// Books in dev not in production (by title)  
const onlyInDev = localBooks.filter((r: any) => !liveByTitle.has((r.title || '').toLowerCase().trim()));

// Orphan drafts (draft has no book linked to it via source_draft_id)
const orphanRows = await db.execute(sql`
  SELECT d.id, d.title, d.status, COALESCE(LENGTH(d.content), 0) AS content_len
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL
    AND d.status = 'published'
  ORDER BY d.id
`) as any;
const orphanDrafts: any[] = orphanRows.rows ?? [];

console.log(`Production: ${liveBooks.length} books`);
console.log(`Dev:        ${localBooks.length} books`);
console.log('');

console.log(`═══ In PRODUCTION but NOT in dev (${onlyInProd.length}): ═══`);
onlyInProd.forEach((b: any) => console.log(`  prod #${b.id} "${b.title}"`));

console.log(`\n═══ In DEV but NOT in production (${onlyInDev.length}): ═══`);
onlyInDev.forEach((r: any) => console.log(`  dev  #${r.id} "${r.title}"`));

console.log(`\n═══ Orphan published drafts with no book linked (${orphanDrafts.length}): ═══`);
orphanDrafts.forEach((r: any) => console.log(`  draft #${r.id} "${r.title}" [${r.content_len} chars]`));

// Cross-reference: production-only books that have an orphan draft match
if (onlyInProd.length > 0 && orphanDrafts.length > 0) {
  console.log('\n═══ Production-only books that have a matching orphan draft: ═══');
  for (const b of onlyInProd) {
    const key = (b.title || '').toLowerCase().trim();
    const match = orphanDrafts.find((d: any) => (d.title || '').toLowerCase().trim() === key);
    if (match) console.log(`  prod #${b.id} "${b.title}" ↔ orphan draft #${match.id} [${match.content_len} chars]`);
    else console.log(`  prod #${b.id} "${b.title}" — no orphan draft match`);
  }
}

process.exit(0);
