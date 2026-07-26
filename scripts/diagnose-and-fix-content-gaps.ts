/**
 * Diagnose & fix: books showing no content in Content Studio
 *
 * Two problems:
 *   1. Books linked to a draft whose title doesn't match (wrong draft ID) → re-link by title
 *   2. Correctly-linked drafts that have no content locally → pull from production
 */
import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('[ DRY RUN — no writes ]\n');

// ── 1. Diagnose mismatches ──────────────────────────────────────────────────

const mismatchRows = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.source_draft_id,
         d.id AS draft_id, d.title AS draft_title,
         COALESCE(LENGTH(d.content), 0) AS content_len, d.status
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE LOWER(TRIM(b.title)) != LOWER(TRIM(d.title))
  ORDER BY b.id
`) as any;

const mismatches: any[] = mismatchRows.rows ?? [];

const emptyRows = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.source_draft_id,
         d.id AS draft_id, d.title AS draft_title, d.status
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE (d.content IS NULL OR LENGTH(d.content) < 100)
    AND b.visible = true
    AND LOWER(TRIM(b.title)) = LOWER(TRIM(d.title))
  ORDER BY b.id
`) as any;
const emptyCorrectLink: any[] = emptyRows.rows ?? [];

console.log('════════════════════════════════════════════════════════');
console.log(`PROBLEM 1 — Books linked to WRONG draft: ${mismatches.length}`);
console.log('════════════════════════════════════════════════════════');
mismatches.forEach(r => {
  console.log(`  Book #${r.book_id} "${r.book_title}"`);
  console.log(`    → linked to draft #${r.draft_id} "${r.draft_title}" [${r.content_len} chars, ${r.status}]`);
});

console.log('\n════════════════════════════════════════════════════════');
console.log(`PROBLEM 2 — Correct link but NO content locally: ${emptyCorrectLink.length}`);
console.log('════════════════════════════════════════════════════════');
emptyCorrectLink.forEach(r => {
  console.log(`  Book #${r.book_id} "${r.book_title}" → draft #${r.draft_id} [${r.status}]`);
});

if (DRY_RUN) {
  console.log('\nRe-run without --dry-run to apply fixes.');
  process.exit(0);
}

// ── 2. Fix wrong draft links ────────────────────────────────────────────────

let relinked = 0;
let stubsCreated = 0;

for (const r of mismatches) {
  // Look for an existing draft whose title matches the book title
  const existing = await db.execute(sql`
    SELECT id FROM draft_ebooks
    WHERE LOWER(TRIM(title)) = LOWER(TRIM(${r.book_title}))
    ORDER BY
      CASE WHEN status = 'published' THEN 0 ELSE 1 END,
      id ASC
    LIMIT 1
  `) as any;

  let newDraftId: number;
  if (existing.rows.length > 0) {
    newDraftId = existing.rows[0].id;
    console.log(`  [relink] Book #${r.book_id} → existing draft #${newDraftId} (title matches)`);
  } else {
    // Create a stub draft with the correct title
    const [nd] = await db.insert(draftEbooks).values({
      title: r.book_title,
      genre: 'Non-Fiction', // will be overwritten when content is pulled
      topic: r.book_title,
      status: 'published',
    } as any).returning({ id: draftEbooks.id });
    newDraftId = nd.id;
    stubsCreated++;
    console.log(`  [stub]   Book #${r.book_id} "${r.book_title}" → new draft #${newDraftId}`);
  }

  await db.update(books).set({ sourceDraftId: newDraftId } as any).where(eq(books.id, r.book_id));
  relinked++;
}

console.log(`\nFixed wrong links: ${relinked} (${stubsCreated} new stubs created)`);

// ── 3. Pull content from production for all empty drafts ────────────────────

// Collect all visible books with empty draft content (after fix above)
const needContentRows = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, d.id AS draft_id, d.genre AS draft_genre
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE (d.content IS NULL OR LENGTH(d.content) < 100)
    AND b.visible = true
  ORDER BY b.id
`) as any;
const needContent: any[] = needContentRows.rows ?? [];

if (needContent.length === 0) {
  console.log('\nAll visible books already have draft content — nothing more to pull.');
  process.exit(0);
}

console.log(`\nNeed to pull content for ${needContent.length} book(s) from production...`);

// Authenticate with production
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) throw new Error('ADMIN_PASSWORD not set');

const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: adminPassword }),
});
if (!loginRes.ok) throw new Error(`Production login failed (${loginRes.status})`);
const liveToken = (await loginRes.json() as any).token;
if (!liveToken) throw new Error('No token returned from production login');
console.log('Authenticated with production ✓');

// Fetch all published drafts from production (content included)
// Use the export-drafts-for-pull endpoint if available, else drafts list
const titlesWanted = needContent.map(r => r.book_title);
const exportRes = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
  body: JSON.stringify({ titles: titlesWanted }),
});
if (!exportRes.ok) throw new Error(`export-drafts-for-pull failed (${exportRes.status})`);
const exportData = await exportRes.json() as any;
const liveDrafts: any[] = Array.isArray(exportData) ? exportData : (exportData.drafts ?? []);
console.log(`Production returned ${liveDrafts.length} matching draft(s)`);

// Build title → draft map
const liveByTitle = new Map<string, any>();
for (const ld of liveDrafts) {
  const key = (ld.title ?? '').toLowerCase().trim();
  if (key) liveByTitle.set(key, ld);
}

let pulled = 0;
let notFound = 0;
const notFoundTitles: string[] = [];

for (const row of needContent) {
  const key = (row.book_title ?? '').toLowerCase().trim();
  const live = liveByTitle.get(key);
  if (!live || (!live.content && !live.outline)) {
    notFound++;
    notFoundTitles.push(row.book_title);
    continue;
  }

  const updateFields: Record<string, any> = {};
  if (live.content) updateFields.content = live.content;
  if (live.outline) updateFields.outline = live.outline;
  if (live.description) updateFields.description = live.description;
  if (live.genre) updateFields.genre = live.genre;
  if (live.coverUrl) updateFields.coverUrl = live.coverUrl;
  if (live.status) updateFields.status = live.status;
  updateFields.updatedAt = new Date();

  await db.update(draftEbooks).set(updateFields as any).where(eq(draftEbooks.id, row.draft_id));
  console.log(`  ✓ Pulled content for "${row.book_title}" (${(live.content ?? '').length} chars) → draft #${row.draft_id}`);
  pulled++;
}

console.log('\n════════════════════════════════════════════════════════');
console.log(`Content pulled: ${pulled}`);
if (notFound > 0) {
  console.log(`Not found in production (${notFound}): content doesn't exist there yet`);
  notFoundTitles.forEach(t => console.log(`  - ${t}`));
}
console.log('════════════════════════════════════════════════════════');
process.exit(0);
