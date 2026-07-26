/**
 * Thorough audit:
 * 1. Every visible dev book — does its draft have content?
 * 2. Every live production book — does dev have a matching draft with content?
 * 3. Cursor "push rename" / "push to live" books (drafts 826-856+) —
 *    do their titles already exist on production? Any title mismatches?
 * 4. Summary of orphan published drafts remaining after cleanup.
 */
import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

const liveRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
const liveByTitle = new Map<string, any>(liveBooks.map(b => [(b.title||'').toLowerCase().trim(), b]));
const liveIds = new Set(liveBooks.map(b => b.id));

// ── 1. Dev visible books with empty drafts ───────────────────────────────────
const emptyDev = await db.execute(sql`
  SELECT b.id, b.title, d.id AS draft_id, COALESCE(LENGTH(d.content),0) AS len
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.visible = true AND (d.content IS NULL OR LENGTH(d.content) < 100)
  ORDER BY b.id
`) as any;

// ── 2. Live books missing from dev altogether ────────────────────────────────
const devRows = await db.execute(sql`
  SELECT b.id, b.title, b.visible,
         d.id AS draft_id, COALESCE(LENGTH(d.content),0) AS content_len
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  ORDER BY b.id
`) as any;
const devByTitle = new Map<string, any>(
  (devRows.rows as any[]).map(r => [(r.title||'').toLowerCase().trim(), r])
);
const missingFromDev = liveBooks.filter(b => !devByTitle.has((b.title||'').toLowerCase().trim()));

// ── 3. Cursor "push rename/live" books — high draft IDs ──────────────────────
// These are drafts we haven't published yet (no book record)
const cursorDrafts = await db.execute(sql`
  SELECT d.id, d.title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len,
         b.id AS book_id
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.id >= 826 AND d.status = 'published'
  ORDER BY d.id
`) as any;

// ── 4. Orphan published drafts remaining ────────────────────────────────────
const orphans = await db.execute(sql`
  SELECT d.id, d.title, COALESCE(LENGTH(d.content),0) AS content_len
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL AND d.status = 'published'
  ORDER BY d.id
`) as any;

// ── Output ────────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════════════════════════');
console.log(`1. DEV VISIBLE BOOKS WITH EMPTY CONTENT (${emptyDev.rows.length})`);
console.log('════════════════════════════════════════════════════════════════');
if (emptyDev.rows.length === 0) console.log('   ✅ All visible books have content.');
for (const r of (emptyDev.rows as any[])) console.log(`   ❌ Book #${r.id} "${r.title}" → draft #${r.draft_id} [${r.len} chars]`);

console.log(`\n════════════════════════════════════════════════════════════════`);
console.log(`2. LIVE BOOKS NOT IN DEV AT ALL (${missingFromDev.length})`);
console.log('════════════════════════════════════════════════════════════════');
if (missingFromDev.length === 0) console.log('   ✅ All production books are in dev.');
for (const b of missingFromDev) console.log(`   ❌ "${b.title}" (prod #${b.id})`);

console.log(`\n════════════════════════════════════════════════════════════════`);
console.log(`3. CURSOR BOOKS (draft ID ≥ 826) — ${(cursorDrafts.rows as any[]).length} drafts`);
console.log('════════════════════════════════════════════════════════════════');
for (const r of (cursorDrafts.rows as any[])) {
  const onProd = liveByTitle.has((r.title||'').toLowerCase().trim());
  const linked = r.book_id ? `→ book #${r.book_id}` : '→ no book (not pushed yet)';
  const prodStatus = onProd ? '✅ matches production' : '🆕 new (not yet on live)';
  console.log(`   Draft #${r.id} "${(r.title||'').slice(0,55)}" [${r.content_len.toLocaleString()} chars] ${linked} | ${prodStatus}`);
}

console.log(`\n════════════════════════════════════════════════════════════════`);
console.log(`4. PUBLISHED ORPHAN DRAFTS REMAINING (${(orphans.rows as any[]).length})`);
console.log('════════════════════════════════════════════════════════════════');
for (const r of (orphans.rows as any[])) {
  const onProd = liveByTitle.has((r.title||'').toLowerCase().trim());
  console.log(`   Draft #${r.id} "${(r.title||'').slice(0,55)}" [${r.content_len.toLocaleString()} chars] ${onProd ? '(title on prod)' : ''}`);
}

console.log(`\n════════════════════════════════════════════════════════════════`);
console.log(`TOTALS`);
console.log('════════════════════════════════════════════════════════════════');
console.log(`   Dev visible books with no content: ${emptyDev.rows.length}`);
console.log(`   Live books missing from dev:        ${missingFromDev.length}`);
console.log(`   Cursor pending drafts (≥826):       ${(cursorDrafts.rows as any[]).length}`);
console.log(`   Published orphans remaining:        ${(orphans.rows as any[]).length}`);
process.exit(0);
