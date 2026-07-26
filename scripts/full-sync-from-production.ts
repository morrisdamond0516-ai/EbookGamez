/**
 * Full sync: for every book in production that doesn't exist in dev by title,
 * update or insert the dev record at the correct production ID, link/create a draft,
 * and pull content from production.
 *
 * This handles: ID-collision replacements (old placeholder → proper title),
 * truly missing books, and orphan-draft linkage.
 */
import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

// ── Auth ────────────────────────────────────────────────────────────────────
const adminPassword = process.env.ADMIN_PASSWORD!;
const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: adminPassword }),
});
const liveToken = (await loginRes.json() as any).token;
console.log('Authenticated with production ✓\n');

// ── Fetch all books ─────────────────────────────────────────────────────────
const liveBooksRes = await fetch(`${liveUrl}/api/books?limit=2000`);
const liveBooksData = await liveBooksRes.json() as any;
const liveBooks: any[] = Array.isArray(liveBooksData) ? liveBooksData : (liveBooksData.books ?? []);

const localRows = await db.execute(sql`SELECT id, title FROM books`) as any;
const localBooks: any[] = localRows.rows ?? [];
const localByTitle = new Map(localBooks.map((r: any) => [(r.title || '').toLowerCase().trim(), r]));

// ── Production books not in dev by title ────────────────────────────────────
const missing = liveBooks.filter((b: any) => !localByTitle.has((b.title || '').toLowerCase().trim()));
console.log(`Books to sync from production: ${missing.length}\n`);

if (missing.length === 0) {
  console.log('Dev is fully in sync with production.');
  process.exit(0);
}

// ── Pull content for all missing books in one batch request ─────────────────
const titlesWanted = missing.map((b: any) => b.title);
const exportRes = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
  body: JSON.stringify({ titles: titlesWanted }),
});
const exportData = exportRes.ok ? await exportRes.json() as any : {};
const liveDrafts: any[] = Array.isArray(exportData) ? exportData : (exportData.drafts ?? []);
const liveContentByTitle = new Map<string, any>();
for (const ld of liveDrafts) {
  const key = (ld.title ?? '').toLowerCase().trim();
  if (key) liveContentByTitle.set(key, ld);
}
console.log(`Got content from production for ${liveContentByTitle.size} drafts\n`);

// ── Fetch orphan published drafts (to reuse existing ones) ──────────────────
const orphanRows = await db.execute(sql`
  SELECT d.id, d.title FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL
`) as any;
const orphanByTitle = new Map<string, number>();
for (const r of (orphanRows.rows ?? [])) {
  orphanByTitle.set((r.title || '').toLowerCase().trim(), r.id);
}

// ── Process each missing book ───────────────────────────────────────────────
let synced = 0; let errors: string[] = [];

for (const b of missing) {
  try {
    // Fetch full detail for author, category, price etc.
    const detailRes = await fetch(`${liveUrl}/api/books/${b.id}`);
    const detail: any = detailRes.ok ? await detailRes.json() : b;

    const title = detail.title || b.title;
    const key = title.toLowerCase().trim();
    const liveContent = liveContentByTitle.get(key);

    // Find or create a local draft
    // Priority: orphan draft with matching title > create new
    let draftId: number;
    const orphanId = orphanByTitle.get(key);
    if (orphanId) {
      // Reuse the orphan draft and update its content
      await db.update(draftEbooks).set({
        content: liveContent?.content || null,
        outline: liveContent?.outline || null,
        description: liveContent?.description || detail.description || null,
        genre: liveContent?.genre || detail.genre || 'Non-Fiction',
        coverUrl: liveContent?.coverUrl || detail.coverUrl || null,
        status: 'published',
      } as any).where(eq(draftEbooks.id, orphanId));
      draftId = orphanId;
    } else {
      // Check if a draft already exists for this title (not orphan — may be linked to another book)
      const existingDraft = await db.execute(sql`
        SELECT id FROM draft_ebooks WHERE LOWER(TRIM(title)) = LOWER(TRIM(${title})) LIMIT 1
      `) as any;
      if (existingDraft.rows.length > 0) {
        draftId = existingDraft.rows[0].id;
        // Update content if empty
        if (liveContent?.content) {
          await db.update(draftEbooks).set({
            content: liveContent.content,
            outline: liveContent.outline || null,
          } as any).where(eq(draftEbooks.id, draftId));
        }
      } else {
        const [nd] = await db.insert(draftEbooks).values({
          title,
          genre: liveContent?.genre || detail.genre || b.genre || 'Non-Fiction',
          topic: title,
          status: 'published',
          content: liveContent?.content || null,
          outline: liveContent?.outline || null,
          description: liveContent?.description || detail.description || null,
          coverUrl: liveContent?.coverUrl || detail.coverUrl || b.coverUrl || null,
        } as any).returning({ id: draftEbooks.id });
        draftId = nd.id;
      }
    }

    // Upsert the book row at the production ID
    await db.execute(sql`
      INSERT INTO books (id, title, author, genre, category, price, cover_url, description, visible, cover_fit, source_draft_id, created_at)
      VALUES (
        ${b.id},
        ${title},
        ${detail.author || b.author || 'Unknown'},
        ${detail.genre || b.genre || 'Non-Fiction'},
        ${detail.category || b.category || 'ebooks'},
        ${String(detail.price ?? b.price ?? '9.99')},
        ${detail.coverUrl || b.coverUrl || ''},
        ${detail.description || null},
        ${detail.visible ?? true},
        ${detail.coverFit || 'cover'},
        ${draftId},
        ${new Date(detail.createdAt || Date.now())}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        author = EXCLUDED.author,
        genre = EXCLUDED.genre,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        cover_url = EXCLUDED.cover_url,
        description = EXCLUDED.description,
        visible = EXCLUDED.visible,
        cover_fit = EXCLUDED.cover_fit,
        source_draft_id = EXCLUDED.source_draft_id
    `);

    const contentNote = liveContent?.content
      ? `${liveContent.content.length.toLocaleString()} chars`
      : 'no content in prod';
    console.log(`  ✅ #${b.id} "${title}" → draft #${draftId} [${contentNote}]`);
    synced++;
  } catch (err: any) {
    errors.push(`#${b.id} "${b.title}": ${err.message}`);
    console.log(`  ✗ #${b.id} "${b.title}": ${err.message}`);
  }
}

// Reset sequences
await db.execute(sql`SELECT setval('books_id_seq', (SELECT MAX(id) FROM books))`);
await db.execute(sql`SELECT setval('draft_ebooks_id_seq', (SELECT MAX(id) FROM draft_ebooks))`);

console.log(`\n════════════════════════════════════════════════════════`);
console.log(`Synced: ${synced}/${missing.length}`);
if (errors.length) { console.log('Errors:'); errors.forEach(e => console.log('  ✗', e)); }
console.log(`════════════════════════════════════════════════════════`);

// ── Final verification ──────────────────────────────────────────────────────
const finalRows = await db.execute(sql`SELECT id, title FROM books`) as any;
const finalByTitle = new Set(finalRows.rows.map((r: any) => (r.title || '').toLowerCase().trim()));
const stillMissing = liveBooks.filter((b: any) => !finalByTitle.has((b.title || '').toLowerCase().trim()));
console.log(`\nRemaining gaps: ${stillMissing.length}`);
stillMissing.forEach((b: any) => console.log(`  still missing: #${b.id} "${b.title}"`));

process.exit(0);
