import pg from "pg";
import fs from "fs";
import path from "path";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const recent = await client.query(`
  SELECT de.id, de.title, de.cover_url, de.background_url,
         b.cover_url AS book_cover
  FROM draft_ebooks de
  LEFT JOIN books b ON LOWER(TRIM(b.title)) = LOWER(TRIM(de.title))
  WHERE de.status = 'published'
  ORDER BY de.id DESC
  LIMIT 15
`);

let localOk = 0;
let localMissing = 0;
let noUrl = 0;

console.log("=== Recent published drafts ===\n");
for (const row of recent.rows) {
  const url = row.cover_url || row.background_url || row.book_cover;
  let status = "NO URL";
  if (url) {
    const filename = url.replace(/^\/(?:uploads|objstore)\/covers\//, "");
    const localPath = path.join(process.cwd(), "uploads", "covers", filename);
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
      status = "LOCAL OK";
      localOk++;
    } else {
      status = "LOCAL MISSING";
      localMissing++;
    }
  } else {
    noUrl++;
  }
  console.log(`[${row.id}] ${status}`);
  console.log(`  draft cover:  ${row.cover_url || "(none)"}`);
  console.log(`  background:   ${row.background_url || "(none)"}`);
  console.log(`  book catalog: ${row.book_cover || "(none)"}`);
  console.log();
}

const totals = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE cover_url IS NULL AND background_url IS NULL)::int AS no_draft_url,
    COUNT(*) FILTER (WHERE cover_url LIKE '/objstore/%' OR background_url LIKE '/objstore/%')::int AS objstore,
    COUNT(*) FILTER (WHERE cover_url LIKE '/uploads/%' OR background_url LIKE '/uploads/%')::int AS uploads
  FROM draft_ebooks WHERE status = 'published'
`);
console.log("Totals:", totals.rows[0]);

// Count how many uploads paths have missing local files
const all = await client.query(`
  SELECT id, cover_url, background_url FROM draft_ebooks WHERE status = 'published'
`);
let missingFiles = 0;
for (const row of all.rows) {
  const url = row.cover_url || row.background_url;
  if (!url?.includes("/covers/")) continue;
  const filename = url.replace(/^\/(?:uploads|objstore)\/covers\//, "");
  const fp = path.join(process.cwd(), "uploads", "covers", filename);
  if (!fs.existsSync(fp)) missingFiles++;
}
console.log(`Published drafts with missing local cover file: ${missingFiles}/${all.rowCount}`);

await client.end();
