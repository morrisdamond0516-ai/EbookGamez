/**
 * Download cover images from production into uploads/covers/
 * and rewrite book.cover_url to /uploads/covers/...
 *
 * Run: npm run sync:covers
 * Uses NODE_OPTIONS=--use-system-ca (see package.json) for Windows TLS.
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const PRODUCTION_BASE = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";
const CONCURRENCY = 8;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const coversRoot = path.join(process.cwd(), "uploads", "covers");

function coverPathFromUrl(coverUrl: string): string | null {
  const prefix = "/objstore/covers/";
  if (!coverUrl.startsWith(prefix)) return null;
  return coverUrl.slice(prefix.length);
}

async function downloadCover(relativePath: string): Promise<boolean> {
  const dest = path.join(coversRoot, relativePath);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return true;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const url = `${PRODUCTION_BASE}/objstore/covers/${relativePath.split("/").map(encodeURIComponent).join("/")}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok || !res.body) {
        console.warn(`  FAIL ${res.status} ${relativePath}`);
        return false;
      }

      const tmp = `${dest}.tmp`;
      await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));
      fs.renameSync(tmp, dest);
      return true;
    } catch (err: any) {
      if (attempt === 3) {
        console.warn(`  FAIL ${relativePath}: ${err.cause?.message || err.message}`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return false;
}

const { rows } = await pool.query<{ cover_url: string }>(
  `SELECT DISTINCT cover_url FROM books WHERE cover_url LIKE '/objstore/covers/%'`,
);

console.log(`Found ${rows.length} unique cover(s) to sync from ${PRODUCTION_BASE}`);

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < rows.length; i += CONCURRENCY) {
  const batch = rows.slice(i, i + CONCURRENCY);
  await Promise.all(
    batch.map(async ({ cover_url }) => {
      const rel = coverPathFromUrl(cover_url);
      if (!rel) return;
      const dest = path.join(coversRoot, rel);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        skipped++;
        return;
      }
      const ok = await downloadCover(rel);
      if (ok) downloaded++;
      else failed++;
    }),
  );
  if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= rows.length) {
    console.log(`Progress: ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}`);
  }
}

console.log(`\nDownload: ${downloaded} new, ${skipped} already cached, ${failed} failed`);

if (failed === 0 || downloaded > 0 || skipped > 0) {
  const update = await pool.query(`
    UPDATE books
    SET cover_url = REPLACE(cover_url, '/objstore/covers/', '/uploads/covers/')
    WHERE cover_url LIKE '/objstore/covers/%'
  `);
  console.log(`Updated ${update.rowCount} book row(s) to /uploads/covers/ paths`);
} else {
  console.log("Skipping DB update — no covers downloaded.");
}

await pool.end();
console.log("Done.");
