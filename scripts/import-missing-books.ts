import { db } from '../server/storage';
import { books, draftEbooks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

async function main() {
  // 1. Fetch all books from production
  console.log('Fetching live book list...');
  const liveRes = await fetch(`${liveUrl}/api/books?limit=2000`);
  const liveData = await liveRes.json() as any;
  const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
  console.log(`Live books: ${liveBooks.length}`);

  // 2. Get local books
  const localRows = await db.select({ id: books.id, title: books.title }).from(books);
  const localIds = new Set(localRows.map((r: any) => r.id));
  const localTitles = new Set(localRows.map((r: any) => (r.title || '').toLowerCase().trim()));
  console.log(`Local books: ${localIds.size}`);

  // 3. Find absent books (not in dev by ID, and title not already present under a different ID)
  const newBooks = liveBooks.filter((b: any) =>
    !localIds.has(b.id) && !localTitles.has((b.title || '').toLowerCase().trim())
  );
  console.log(`\nBooks on live but not in dev: ${newBooks.length}`);

  if (newBooks.length === 0) {
    console.log('Nothing to import — dev library is up to date.');
    process.exit(0);
  }

  newBooks.forEach((b: any) => console.log(`  #${b.id}: ${b.title} [${b.genre || 'unknown'}]`));

  // 4. Import each one
  console.log('\nImporting...');
  let inserted = 0;
  const errors: string[] = [];

  for (const b of newBooks) {
    try {
      // Fetch full book detail from live (includes description, author, etc.)
      const detailRes = await fetch(`${liveUrl}/api/books/${b.id}`);
      if (!detailRes.ok) {
        errors.push(`Book ${b.id} "${b.title}": live detail fetch failed (${detailRes.status})`);
        continue;
      }
      const detail: any = await detailRes.json();

      // Check if a draft already exists locally for this title
      const existingDraft = await db.select({ id: draftEbooks.id })
        .from(draftEbooks)
        .where(sql`LOWER(TRIM(${draftEbooks.title})) = LOWER(TRIM(${detail.title || b.title}))`)
        .limit(1);

      let draftId: number;

      if (existingDraft.length > 0) {
        draftId = existingDraft[0].id;
        console.log(`  [reuse draft ${draftId}] #${b.id} "${detail.title || b.title}"`);
      } else {
        // Try to use the sourceDraftId from production if slot is free
        const wantedId: number | null = (detail.sourceDraftId as number | undefined) ?? null;
        let useId: number | undefined;
        if (wantedId) {
          const taken = await db.select({ id: draftEbooks.id }).from(draftEbooks).where(eq(draftEbooks.id, wantedId)).limit(1);
          if (taken.length === 0) useId = wantedId;
        }

        const insertValues: any = {
          title: detail.title || b.title,
          genre: detail.genre || b.genre || 'Fiction',
          topic: detail.title || b.title, // topic required; use title as fallback
          description: detail.description || null,
          status: 'published',
          coverUrl: detail.coverUrl || b.coverUrl || null,
        };
        if (useId) insertValues.id = useId;

        const [newDraft] = await db.insert(draftEbooks).values(insertValues).returning({ id: draftEbooks.id });
        draftId = newDraft.id;
        console.log(`  [new draft ${draftId}] #${b.id} "${detail.title || b.title}"`);
      }

      // Insert the book — override sequences by providing explicit id
      await db.execute(sql`
        INSERT INTO books (id, title, author, genre, category, price, cover_url, description, visible, cover_fit, source_draft_id, created_at)
        VALUES (
          ${b.id},
          ${detail.title || b.title},
          ${detail.author || b.author || 'Unknown'},
          ${detail.genre || b.genre || 'Fiction'},
          ${detail.category || b.category || 'ebooks'},
          ${(detail.price ?? b.price ?? '9.99').toString()},
          ${detail.coverUrl || b.coverUrl || ''},
          ${detail.description || null},
          ${detail.visible ?? b.visible ?? true},
          ${detail.coverFit || 'cover'},
          ${draftId},
          ${new Date(detail.createdAt || Date.now())}
        )
        ON CONFLICT (id) DO NOTHING
      `);

      inserted++;
    } catch (err: any) {
      errors.push(`Book ${b.id} "${b.title}": ${err.message}`);
    }
  }

  // Reset books sequence so new inserts don't collide
  await db.execute(sql`SELECT setval('books_id_seq', (SELECT MAX(id) FROM books))`);

  console.log(`\n✓ Done. Inserted: ${inserted} / ${newBooks.length}`);
  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log('  ✗', e));
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
