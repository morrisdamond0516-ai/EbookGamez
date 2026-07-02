/**
 * Heal published draft cover URLs: upload local files to object storage,
 * fall back to matching catalog cover when draft image is missing.
 *
 * Run: npx tsx --env-file=.env script/heal-published-covers.ts
 */
import pg from "pg";
import { ensureCoverPersisted } from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const rows = await client.query(`
  SELECT de.id, de.title, de.cover_url, de.background_url,
         (SELECT b.cover_url FROM books b WHERE LOWER(TRIM(b.title)) = LOWER(TRIM(de.title)) LIMIT 1) AS book_cover_url,
         (SELECT b.cover_url FROM books b
          WHERE b.cover_url IS NOT NULL AND b.cover_url != ''
            AND (
              LOWER(TRIM(b.title)) = LOWER(TRIM(de.title))
              OR (char_length(TRIM(de.title)) >= 15 AND LOWER(TRIM(b.title)) LIKE LOWER(TRIM(de.title)) || '%')
              OR (char_length(TRIM(b.title)) >= 15 AND LOWER(TRIM(de.title)) LIKE LOWER(TRIM(b.title)) || '%')
            )
          ORDER BY CASE WHEN LOWER(TRIM(b.title)) = LOWER(TRIM(de.title)) THEN 0 ELSE 1 END, length(b.title) DESC
          LIMIT 1) AS similar_book_cover,
         (SELECT d2.cover_url FROM draft_ebooks d2
          WHERE d2.id != de.id AND d2.cover_url IS NOT NULL AND d2.cover_url != ''
            AND (
              LOWER(TRIM(d2.title)) = LOWER(TRIM(de.title))
              OR (char_length(TRIM(de.title)) >= 15 AND LOWER(TRIM(d2.title)) LIKE LOWER(TRIM(de.title)) || '%')
              OR (char_length(TRIM(d2.title)) >= 15 AND LOWER(TRIM(de.title)) LIKE LOWER(TRIM(d2.title)) || '%')
            )
          ORDER BY CASE WHEN LOWER(TRIM(d2.title)) = LOWER(TRIM(de.title)) THEN 0 ELSE 1 END, length(d2.content) DESC NULLS LAST
          LIMIT 1) AS similar_draft_cover
  FROM draft_ebooks de
  WHERE de.status = 'published'
  ORDER BY de.id
`);

let healed = 0;
let stillMissing = 0;

for (const draft of rows.rows) {
  let coverUrl = draft.cover_url as string | null;
  let backgroundUrl = draft.background_url as string | null;

  if (coverUrl) coverUrl = await ensureCoverPersisted(coverUrl);
  if (backgroundUrl) backgroundUrl = await ensureCoverPersisted(backgroundUrl);

  if (!coverUrl && backgroundUrl) coverUrl = backgroundUrl;
  if (!coverUrl && !backgroundUrl && draft.book_cover_url) {
    coverUrl = await ensureCoverPersisted(draft.book_cover_url);
  }
  // Only guess from similar titles when still empty — production sync (sync:prod-covers) is preferred
  if (!coverUrl && !backgroundUrl && draft.similar_book_cover) {
    coverUrl = await ensureCoverPersisted(draft.similar_book_cover);
    backgroundUrl = coverUrl;
    console.log(`  SIMILAR BOOK [${draft.id}] from title prefix match`);
  }
  if (!coverUrl && !backgroundUrl && draft.similar_draft_cover) {
    coverUrl = await ensureCoverPersisted(draft.similar_draft_cover);
    backgroundUrl = coverUrl;
    console.log(`  SIMILAR DRAFT [${draft.id}] from title prefix match`);
  }

  if (!coverUrl && !backgroundUrl) {
    stillMissing++;
    console.warn(`  MISSING [${draft.id}] ${draft.title?.slice(0, 60)}`);
    continue;
  }

  if (coverUrl !== draft.cover_url || backgroundUrl !== draft.background_url) {
    await client.query(
      "UPDATE draft_ebooks SET cover_url = $1, background_url = $2 WHERE id = $3",
      [coverUrl, backgroundUrl, draft.id],
    );
    healed++;
    console.log(`  FIXED [${draft.id}] -> ${coverUrl}`);
  }
}

console.log(`\nDone: ${healed} healed, ${stillMissing} still missing cover files`);
await client.end();
