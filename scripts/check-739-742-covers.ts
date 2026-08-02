import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const r = await db.execute(sql`
  SELECT d.id, d.title, d.cover_url,
    (SELECT id FROM books WHERE cover_url = d.cover_url LIMIT 1) AS book_using_cover,
    (SELECT title FROM books WHERE cover_url = d.cover_url LIMIT 1) AS book_title_using_cover,
    (SELECT id FROM draft_ebooks WHERE cover_url = d.cover_url AND id != d.id LIMIT 1) AS draft_using_cover,
    (SELECT title FROM draft_ebooks WHERE cover_url = d.cover_url AND id != d.id LIMIT 1) AS draft_title_using_cover
  FROM draft_ebooks d WHERE d.id IN (739, 742)
`) as any;

for (const row of r.rows as any[]) {
  console.log(`\nDraft #${row.id} — "${row.title}"`);
  console.log(`  Cover: ${row.cover_url}`);
  console.log(`  Cover used by book:  ${row.book_using_cover ? `#${row.book_using_cover} "${row.book_title_using_cover}"` : 'none'}`);
  console.log(`  Cover used by draft: ${row.draft_using_cover ? `#${row.draft_using_cover} "${row.draft_title_using_cover}"` : 'none'}`);
}

process.exit(0);
