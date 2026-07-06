/**
 * Link existing catalog books to their source AI Studio drafts.
 * Run after adding books.source_draft_id: npm run db:push (or script/push-schema.ts)
 *
 *   npx tsx --env-file=.env script/backfill-book-draft-links.ts
 */
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: updated } = await client.query(`
  UPDATE books b
  SET source_draft_id = d.id
  FROM draft_ebooks d
  WHERE b.source_draft_id IS NULL
    AND d.status = 'published'
    AND LOWER(TRIM(b.title)) = LOWER(TRIM(d.title))
  RETURNING b.id AS book_id, b.title, d.id AS draft_id
`);

console.log(`Linked ${updated.length} catalog book(s) to drafts:`);
for (const r of updated) {
  console.log(`  book #${r.book_id} ← draft #${r.draft_id}  ${r.title?.slice(0, 60)}`);
}

const check = await client.query(`
  SELECT b.id AS book_id, b.source_draft_id, b.title
  FROM books b WHERE b.id IN (52) OR b.source_draft_id IN (71, 140)
`);
console.log("\nSpot check:");
for (const r of check.rows) console.log(r);

await client.end();
