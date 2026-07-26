/**
 * 1. Fix the 2 no-draft visible books that have content in production
 * 2. Find ALL books present on production but absent in dev (by both ID and title)
 */
import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

// ── Auth with production ────────────────────────────────────────────────────
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) throw new Error('ADMIN_PASSWORD not set');
const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: adminPassword }),
});
const liveToken = (await loginRes.json() as any).token;
console.log('Authenticated with production ✓\n');

// ── Fetch all live books ────────────────────────────────────────────────────
const liveBooksRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveBooksData = await liveBooksRes.json() as any;
const liveBooks: any[] = Array.isArray(liveBooksData) ? liveBooksData : (liveBooksData.books ?? []);
console.log(`Production books: ${liveBooks.length}`);

// ── Get all local books ─────────────────────────────────────────────────────
const localRows = await db.execute(sql`SELECT id, title FROM books`) as any;
const localAll: any[] = localRows.rows ?? [];
const localIds = new Set(localAll.map((r: any) => r.id));
const localTitles = new Set(localAll.map((r: any) => (r.title || '').toLowerCase().trim()));
console.log(`Dev books: ${localAll.length}\n`);

// ── Find books on production absent in dev (by ID and title) ────────────────
const missing = liveBooks.filter((b: any) =>
  !localIds.has(b.id) && !localTitles.has((b.title || '').toLowerCase().trim())
);
console.log(`══════════════════════════════════════════════════════════`);
console.log(`Books on production NOT in dev: ${missing.length}`);
console.log(`══════════════════════════════════════════════════════════`);
missing.forEach((b: any) => console.log(`  #${b.id} "${b.title}" [${b.genre || 'unknown'}]`));

// ── Fix no-draft visible books (#100, #442) ─────────────────────────────────
const noDraftIds = [100, 442];
const titlesToFix: string[] = [];
for (const bid of noDraftIds) {
  const row = localAll.find((r: any) => r.id === bid);
  if (row) titlesToFix.push(row.title);
}

if (titlesToFix.length > 0) {
  console.log(`\n── Pulling content for ${titlesToFix.length} no-draft books from production... ──`);
  const exportRes = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
    body: JSON.stringify({ titles: titlesToFix }),
  });
  const exportData = exportRes.ok ? await exportRes.json() as any : { drafts: [] };
  const liveDrafts: any[] = Array.isArray(exportData) ? exportData : (exportData.drafts ?? []);

  const liveByTitle = new Map<string, any>();
  for (const ld of liveDrafts) {
    const key = (ld.title ?? '').toLowerCase().trim();
    if (key) liveByTitle.set(key, ld);
  }

  for (const bid of noDraftIds) {
    const row = localAll.find((r: any) => r.id === bid);
    if (!row) continue;
    const live = liveByTitle.get(row.title.toLowerCase().trim());
    if (!live) { console.log(`  ⚠️  No production content for "${row.title}"`); continue; }

    // Create draft
    const insertVals: any = {
      title: live.title || row.title,
      genre: live.genre || 'Non-Fiction',
      topic: live.title || row.title,
      status: 'published',
      content: live.content || null,
      outline: live.outline || null,
      description: live.description || null,
      coverUrl: live.coverUrl || null,
    };
    const [newDraft] = await db.insert(draftEbooks).values(insertVals).returning({ id: draftEbooks.id });
    await db.update(books).set({ sourceDraftId: newDraft.id } as any).where(eq(books.id, bid));
    console.log(`  ✅ Book #${bid} "${row.title}" → new draft #${newDraft.id} (${(live.content || '').length} chars)`);
  }
}

// ── Import any truly missing books ──────────────────────────────────────────
if (missing.length > 0) {
  console.log(`\n── Importing ${missing.length} missing book(s) from production... ──`);
  let imported = 0;
  const errors: string[] = [];

  for (const b of missing) {
    try {
      const detailRes = await fetch(`${liveUrl}/api/books/${b.id}`);
      if (!detailRes.ok) { errors.push(`#${b.id}: fetch failed (${detailRes.status})`); continue; }
      const detail: any = await detailRes.json();

      // Find or create draft
      const existingDraft = await db.execute(sql`
        SELECT id FROM draft_ebooks WHERE LOWER(TRIM(title)) = LOWER(TRIM(${detail.title || b.title})) LIMIT 1
      `) as any;

      let draftId: number;
      if (existingDraft.rows.length > 0) {
        draftId = existingDraft.rows[0].id;
      } else {
        const [nd] = await db.insert(draftEbooks).values({
          title: detail.title || b.title,
          genre: detail.genre || b.genre || 'Non-Fiction',
          topic: detail.title || b.title,
          status: 'published',
          description: detail.description || null,
          coverUrl: detail.coverUrl || b.coverUrl || null,
        } as any).returning({ id: draftEbooks.id });
        draftId = nd.id;
      }

      await db.execute(sql`
        INSERT INTO books (id, title, author, genre, category, price, cover_url, description, visible, cover_fit, source_draft_id, created_at)
        VALUES (
          ${b.id}, ${detail.title || b.title}, ${detail.author || b.author || 'Unknown'},
          ${detail.genre || b.genre || 'Non-Fiction'}, ${detail.category || b.category || 'ebooks'},
          ${String(detail.price ?? b.price ?? '9.99')}, ${detail.coverUrl || b.coverUrl || ''},
          ${detail.description || null}, ${detail.visible ?? true}, ${detail.coverFit || 'cover'},
          ${draftId}, ${new Date(detail.createdAt || Date.now())}
        ) ON CONFLICT (id) DO NOTHING
      `);
      console.log(`  ✅ Imported #${b.id} "${detail.title || b.title}" → draft #${draftId}`);
      imported++;
    } catch (err: any) {
      errors.push(`#${b.id} "${b.title}": ${err.message}`);
    }
  }

  // Reset sequence
  await db.execute(sql`SELECT setval('books_id_seq', (SELECT MAX(id) FROM books))`);

  // Pull content for any newly imported books whose draft is empty
  const newTitles = missing.map((b: any) => b.title);
  const pullRes = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
    body: JSON.stringify({ titles: newTitles }),
  });
  if (pullRes.ok) {
    const pullData = await pullRes.json() as any;
    const pullDrafts: any[] = Array.isArray(pullData) ? pullData : (pullData.drafts ?? []);
    const pullByTitle = new Map<string, any>();
    for (const ld of pullDrafts) {
      const key = (ld.title ?? '').toLowerCase().trim();
      if (key) pullByTitle.set(key, ld);
    }
    for (const b of missing) {
      const live = pullByTitle.get((b.title || '').toLowerCase().trim());
      if (!live?.content) continue;
      await db.execute(sql`
        UPDATE draft_ebooks SET content = ${live.content}, outline = ${live.outline || null}
        WHERE LOWER(TRIM(title)) = LOWER(TRIM(${b.title}))
      `);
      console.log(`  📥 Content pulled for "${b.title}" (${live.content.length} chars)`);
    }
  }

  console.log(`\nImported: ${imported}/${missing.length}`);
  if (errors.length) errors.forEach(e => console.log('  ✗', e));
}

process.exit(0);
