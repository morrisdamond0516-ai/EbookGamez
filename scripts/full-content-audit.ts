/**
 * Full content audit: find every book that has a content gap between dev and production.
 * Checks:
 *   1. Books linked to a wrong-title draft
 *   2. Books with no draft linked at all
 *   3. Books whose correctly-linked draft has no content locally
 *   4. Cross-checks against production to confirm content EXISTS there
 */
import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

// ── 1. Wrong-title draft links ──────────────────────────────────────────────
const wrongLink = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.source_draft_id,
         d.title AS draft_title,
         COALESCE(LENGTH(d.content), 0) AS content_len, d.status
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE LOWER(TRIM(b.title)) != LOWER(TRIM(d.title))
    AND b.visible = true
  ORDER BY b.id
`) as any;

// ── 2. Books with no draft linked ───────────────────────────────────────────
const noDraft = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title
  FROM books b
  WHERE b.source_draft_id IS NULL
    AND b.visible = true
  ORDER BY b.id
`) as any;

// ── 3. Correct link but empty content ───────────────────────────────────────
const emptyContent = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, b.source_draft_id,
         d.title AS draft_title, d.status,
         COALESCE(LENGTH(d.content), 0) AS content_len
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE (d.content IS NULL OR LENGTH(d.content) < 100)
    AND b.visible = true
    AND LOWER(TRIM(b.title)) = LOWER(TRIM(d.title))
  ORDER BY b.id
`) as any;

const w: any[] = wrongLink.rows ?? [];
const n: any[] = noDraft.rows ?? [];
const e: any[] = emptyContent.rows ?? [];

const totalProblems = w.length + n.length + e.length;

console.log('══════════════════════════════════════════════════════════════');
console.log(`FULL CONTENT AUDIT — ${totalProblems} total issues found`);
console.log('══════════════════════════════════════════════════════════════\n');

console.log(`❌ PROBLEM 1 — Wrong draft linked (${w.length} books)`);
w.forEach((r: any) => {
  console.log(`   Book #${r.book_id} "${r.book_title}"`);
  console.log(`     → draft #${r.source_draft_id} "${r.draft_title}" [${r.content_len} chars, ${r.status}]`);
});

console.log(`\n❌ PROBLEM 2 — No draft linked at all (${n.length} books)`);
n.forEach((r: any) => console.log(`   Book #${r.book_id} "${r.book_title}"`));

console.log(`\n❌ PROBLEM 3 — Correct draft linked but no content locally (${e.length} books)`);
e.forEach((r: any) => {
  console.log(`   Book #${r.book_id} "${r.book_title}" → draft #${r.source_draft_id} [${r.status}, ${r.content_len} chars]`);
});

if (totalProblems === 0) {
  console.log('\n✅ All visible books have correct draft links and content.');
  process.exit(0);
}

// ── 4. Verify production actually has content for problem books ─────────────
const problemTitles = [
  ...w.map((r: any) => r.book_title),
  ...n.map((r: any) => r.book_title),
  ...e.map((r: any) => r.book_title),
];

console.log(`\n── Checking production for ${problemTitles.length} problem book(s)... ──`);

const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) { console.log('ADMIN_PASSWORD not set — skipping production check'); process.exit(0); }

const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: adminPassword }),
});
const liveToken = loginRes.ok ? (await loginRes.json() as any).token : null;
if (!liveToken) { console.log('Could not auth with production — skipping'); process.exit(0); }

const exportRes = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
  body: JSON.stringify({ titles: problemTitles }),
});
const exportData = exportRes.ok ? await exportRes.json() as any : { drafts: [] };
const liveDrafts: any[] = Array.isArray(exportData) ? exportData : (exportData.drafts ?? []);

const liveByTitle = new Map<string, any>();
for (const ld of liveDrafts) {
  const key = (ld.title ?? '').toLowerCase().trim();
  if (key) liveByTitle.set(key, ld);
}

console.log('\n── Production content availability ──');
let canFix = 0; let cantFix = 0;
for (const title of problemTitles) {
  const live = liveByTitle.get(title.toLowerCase().trim());
  if (live && (live.content?.length > 100 || live.outline?.length > 50)) {
    console.log(`   ✅ "${title}" — ${live.content?.length ?? 0} chars in production`);
    canFix++;
  } else {
    console.log(`   ⚠️  "${title}" — NOT found / no content in production`);
    cantFix++;
  }
}

console.log(`\nSummary: ${canFix} can be auto-fixed from production, ${cantFix} have no content in production either.`);
process.exit(0);
