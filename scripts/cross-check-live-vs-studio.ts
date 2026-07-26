/**
 * Cross-check: for every visible production book,
 * find the matching dev draft and report whether it has content.
 * Also: find drafts that have content but are linked to books
 * whose title has changed (stale content).
 */
import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

// Fetch all live books
const liveRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
const liveVisible = liveBooks.filter(b => b.visible !== false);

// Get all local book+draft pairs
const local = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.visible,
         d.id AS draft_id, d.title AS draft_title,
         COALESCE(LENGTH(d.content), 0) AS content_len,
         d.cover_url IS NOT NULL AND d.cover_url != '' AS has_cover
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  ORDER BY b.id
`) as any;
const localByTitle = new Map<string, any>();
for (const r of (local.rows as any[])) {
  localByTitle.set((r.book_title||'').toLowerCase().trim(), r);
}

// Problem A: live books whose dev draft has no content
const liveButEmpty: any[] = [];
for (const b of liveVisible) {
  const key = (b.title||'').toLowerCase().trim();
  const dev = localByTitle.get(key);
  if (!dev) { liveButEmpty.push({ ...b, issue: 'not in dev at all' }); continue; }
  if (!dev.draft_id) { liveButEmpty.push({ ...b, ...dev, issue: 'no draft linked' }); continue; }
  if (dev.content_len < 100) { liveButEmpty.push({ ...b, ...dev, issue: 'empty draft' }); }
}

// Problem B: drafts with covers AND content, but the book they're linked to
// no longer matches their title (stale/orphan content)
const staleContent = await db.execute(sql`
  SELECT d.id AS draft_id, d.title AS draft_title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len,
         d.cover_url,
         b.id AS book_id, b.title AS book_title, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.content IS NOT NULL AND LENGTH(d.content) > 100
    AND (
      b.id IS NULL  -- orphan: no book linked
      OR LOWER(TRIM(b.title)) != LOWER(TRIM(d.title))  -- wrong book linked
    )
  ORDER BY d.id
`) as any;

console.log('════════════════════════════════════════════════════════════');
console.log(`PROBLEM A: Live books readable by visitors but NO content in Content Studio`);
console.log(`Found: ${liveButEmpty.length}`);
console.log('════════════════════════════════════════════════════════════');
for (const r of liveButEmpty) {
  console.log(`  Book #${r.book_id ?? r.id} "${(r.book_title ?? r.title)?.slice(0,60)}" — ${r.issue}`);
}

console.log(`\n════════════════════════════════════════════════════════════`);
console.log(`PROBLEM B: Drafts with content but wrong/no book linked (stale content)`);
console.log(`Found: ${staleContent.rows.length}`);
console.log('════════════════════════════════════════════════════════════');
for (const r of (staleContent.rows as any[])) {
  const linked = r.book_id
    ? `→ book #${r.book_id} "${(r.book_title||'').slice(0,35)}" ⚠️ TITLE MISMATCH`
    : `→ ORPHAN (no book linked)`;
  console.log(`  Draft #${r.draft_id} "${(r.draft_title||'').slice(0,50)}" [${r.content_len.toLocaleString()} chars] ${linked}`);
}
process.exit(0);
