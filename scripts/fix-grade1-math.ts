/**
 * Fix Grade 1 Mathematics: Complete School Year
 * - Book #698 exists in production but has no book row in dev
 * - Draft #715 exists locally as an orphan (0 content)
 * - Solution: import book #698, link it to draft #715, pull content from production
 */
import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

// Auth
const adminPassword = process.env.ADMIN_PASSWORD!;
const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: adminPassword }),
});
const liveToken = (await loginRes.json() as any).token;
console.log('Authenticated ✓');

// Fetch full book detail from production
const detailRes = await fetch(`${liveUrl}/api/books/698`);
const detail: any = await detailRes.json();
console.log(`Production book #698: "${detail.title}" [visible:${detail.visible}]`);

// Pull content from production for the draft
const exportRes = await fetch(`${liveUrl}/api/admin/export-drafts-for-pull`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': liveToken },
  body: JSON.stringify({ titles: ['Grade 1 Mathematics: Complete School Year'] }),
});
const exportData = await exportRes.json() as any;
const liveDrafts: any[] = Array.isArray(exportData) ? exportData : (exportData.drafts ?? []);
const liveDraft = liveDrafts[0];
console.log(`Production draft content: ${liveDraft?.content?.length ?? 0} chars`);

// Update local orphan draft #715 with production content
await db.update(draftEbooks).set({
  content: liveDraft?.content || null,
  outline: liveDraft?.outline || null,
  description: liveDraft?.description || detail.description || null,
  genre: liveDraft?.genre || detail.genre || 'Non-Fiction',
  coverUrl: liveDraft?.coverUrl || detail.coverUrl || null,
  status: 'published',
} as any).where(eq(draftEbooks.id, 715));
console.log('Draft #715 updated with production content ✓');

// Insert book #698 linked to draft #715
await db.execute(sql`
  INSERT INTO books (id, title, author, genre, category, price, cover_url, description, visible, cover_fit, source_draft_id, created_at)
  VALUES (
    698,
    ${detail.title || 'Grade 1 Mathematics: Complete School Year'},
    ${detail.author || 'Unknown'},
    ${detail.genre || 'Non-Fiction'},
    ${detail.category || 'ebooks'},
    ${String(detail.price ?? '9.99')},
    ${detail.coverUrl || ''},
    ${detail.description || null},
    ${detail.visible ?? true},
    ${detail.coverFit || 'cover'},
    715,
    ${new Date(detail.createdAt || Date.now())}
  ) ON CONFLICT (id) DO NOTHING
`);
console.log('Book #698 inserted, linked to draft #715 ✓');

// Reset sequence
await db.execute(sql`SELECT setval('books_id_seq', (SELECT MAX(id) FROM books))`);

// Verify
const [check] = await db.select({
  bookId: books.id, bookTitle: books.title, draftId: books.sourceDraftId,
}).from(books).where(eq(books.id, 698));
console.log('\nVerification:', check);

process.exit(0);
