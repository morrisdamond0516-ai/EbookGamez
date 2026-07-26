/**
 * Pull content from production for the 11 books whose drafts are still empty.
 */
import { db } from '../server/storage';
import { draftEbooks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

const adminPassword = process.env.ADMIN_PASSWORD!;
const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: adminPassword }),
});
const liveToken = (await loginRes.json() as any).token;
console.log('Authenticated ✓\n');

// Get the 11 empty drafts linked to visible books
const emptyRows = await db.execute(sql`
  SELECT b.id AS book_id, b.title AS book_title, d.id AS draft_id
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE (d.content IS NULL OR LENGTH(d.content) < 100)
    AND b.visible = true
    AND LOWER(TRIM(b.title)) = LOWER(TRIM(d.title))
  ORDER BY b.id
`) as any;
const empty: any[] = emptyRows.rows ?? [];
console.log(`Empty drafts to fix: ${empty.length}`);

// Pull one at a time via export endpoint to avoid timeouts
let pulled = 0;
const failed: string[] = [];

for (const row of empty) {
  try {
    const res = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
      body: JSON.stringify({ titles: [row.book_title] }),
    });
    if (!res.ok) { failed.push(`${row.book_title}: export ${res.status}`); continue; }
    const data = await res.json() as any;
    const drafts: any[] = Array.isArray(data) ? data : (data.drafts ?? []);
    const live = drafts.find((d: any) => (d.title || '').toLowerCase().trim() === row.book_title.toLowerCase().trim());

    if (!live?.content) { failed.push(`${row.book_title}: no content in production`); continue; }

    await db.update(draftEbooks).set({
      content: live.content,
      outline: live.outline || null,
      description: live.description || null,
      genre: live.genre || undefined,
      coverUrl: live.coverUrl || undefined,
      status: 'published',
    } as any).where(eq(draftEbooks.id, row.draft_id));

    console.log(`  ✅ "${row.book_title}" (${live.content.length.toLocaleString()} chars) → draft #${row.draft_id}`);
    pulled++;
  } catch (err: any) {
    failed.push(`${row.book_title}: ${err.message}`);
  }
}

console.log(`\nPulled: ${pulled}/${empty.length}`);
if (failed.length) { console.log('Could not pull:'); failed.forEach(f => console.log('  ✗', f)); }
process.exit(0);
