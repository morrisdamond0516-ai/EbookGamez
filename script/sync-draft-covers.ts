/**
 * Download all missing cover images for published drafts from production.
 * Run: npm run sync:draft-covers
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fetchCoverFromProduction } from "../server/coverProxy";
import { coverFilenameFromUrl } from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const rows = await client.query(`
  SELECT DISTINCT cover_url AS url FROM draft_ebooks WHERE status = 'published' AND cover_url IS NOT NULL
  UNION
  SELECT DISTINCT background_url AS url FROM draft_ebooks WHERE status = 'published' AND background_url IS NOT NULL
`);

const coversRoot = path.join(process.cwd(), "uploads", "covers");
fs.mkdirSync(coversRoot, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const { url } of rows.rows) {
  const filename = coverFilenameFromUrl(url);
  if (!filename) continue;
  const dest = path.join(coversRoot, filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    skipped++;
    continue;
  }
  const buf = await fetchCoverFromProduction(filename, true);
  if (buf) {
    downloaded++;
    if (downloaded % 20 === 0) console.log(`  ${downloaded} downloaded...`);
  } else {
    failed++;
    console.warn(`  FAIL ${filename}`);
  }
}

console.log(`\nDone: ${downloaded} downloaded, ${skipped} already local, ${failed} failed`);
await client.end();
