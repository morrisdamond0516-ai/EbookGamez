import pg from "pg";
import fs from "fs";
import path from "path";
import { coverFilenameFromUrl, localCoverPath } from "../server/coverStorage";
import { fetchCoverFromProduction } from "../server/coverProxy";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

function fileOk(url: string | null): boolean {
  const fn = coverFilenameFromUrl(url);
  if (!fn) return false;
  const p = localCoverPath(fn);
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

// Find the specific book
const specific = await client.query(`
  SELECT de.id, de.title, de.status, de.cover_url, de.background_url,
         b.id AS book_id, b.cover_url AS book_cover
  FROM draft_ebooks de
  LEFT JOIN books b ON LOWER(TRIM(b.title)) = LOWER(TRIM(de.title))
  WHERE LOWER(de.title) LIKE '%future of quantum computing%'
`);

console.log("=== The Future of Quantum Computing ===\n");
for (const row of specific.rows) {
  console.log(`Draft #${row.id} (${row.status})`);
  console.log(`  cover_url:      ${row.cover_url || "(none)"}`);
  console.log(`  background_url: ${row.background_url || "(none)"}`);
  console.log(`  book #${row.book_id || "?"} cover: ${row.book_cover || "(none)"}`);
  console.log(`  cover file local: ${fileOk(row.cover_url) ? "YES" : "NO"}`);
  console.log(`  bg file local:    ${fileOk(row.background_url) ? "YES" : "NO"}`);
  console.log(`  book file local:  ${fileOk(row.book_cover) ? "YES" : "NO"}`);
}

// Scan all published drafts for broken covers
const all = await client.query(`
  SELECT de.id, de.title, de.cover_url, de.background_url,
         b.cover_url AS book_cover
  FROM draft_ebooks de
  LEFT JOIN books b ON LOWER(TRIM(b.title)) = LOWER(TRIM(de.title))
  WHERE de.status = 'published'
  ORDER BY de.id
`);

type Broken = { id: number; title: string; reason: string; urls: string };
const broken: Broken[] = [];

for (const row of all.rows) {
  const coverOk = fileOk(row.cover_url);
  const bgOk = fileOk(row.background_url);
  const bookOk = fileOk(row.book_cover);

  if (!row.cover_url && !row.background_url) {
    broken.push({ id: row.id, title: row.title, reason: "no URL in draft", urls: "" });
    continue;
  }

  // What the UI tries first: coverUrl, then backgroundUrl
  const displayUrl = row.cover_url || row.background_url;
  if (!fileOk(displayUrl)) {
  // try book catalog as fallback
    if (!bookOk) {
      const urls = [row.cover_url, row.background_url, row.book_cover].filter(Boolean).join(" | ");
      broken.push({
        id: row.id,
        title: row.title,
        reason: row.cover_url && !coverOk && bgOk ? "overlay missing, background exists" : "all cover files missing locally",
        urls,
      });
    }
  }
}

console.log(`\n=== Published drafts with missing/broken cover files: ${broken.length} / ${all.rowCount} ===\n`);
for (const b of broken.slice(0, 30)) {
  console.log(`[#${b.id}] ${b.reason}`);
  console.log(`  ${b.title?.slice(0, 70)}`);
  if (b.urls) console.log(`  ${b.urls.slice(0, 120)}`);
}
if (broken.length > 30) console.log(`\n... and ${broken.length - 30} more`);

// Attempt to fix the quantum computing book from production
if (specific.rows.length > 0) {
  const row = specific.rows[0];
  const urls = [row.cover_url, row.background_url, row.book_cover].filter(Boolean) as string[];
  console.log("\n=== Attempting production download for quantum book ===");
  for (const url of urls) {
    const fn = coverFilenameFromUrl(url);
    if (!fn) continue;
    if (fileOk(url)) { console.log(`  ${fn}: already local`); continue; }
    const buf = await fetchCoverFromProduction(fn, true);
    console.log(`  ${fn}: ${buf ? `downloaded (${buf.length} bytes)` : "NOT on production"}`);
  }
}

await client.end();

// Also list all published with null covers
const client2 = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client2.connect();
const nullCovers = await client2.query(`
  SELECT de.id, de.title, de.status, de.published_at,
         (SELECT b.id FROM books b WHERE LOWER(TRIM(b.title)) = LOWER(TRIM(de.title)) LIMIT 1) AS book_id
  FROM draft_ebooks de
  WHERE de.status = 'published'
    AND (de.cover_url IS NULL OR de.cover_url = '')
    AND (de.background_url IS NULL OR de.background_url = '')
  ORDER BY de.id
`);
console.log(`\n=== All published drafts with zero cover URLs: ${nullCovers.rowCount} ===`);
for (const row of nullCovers.rows) {
  console.log(`  [#${row.id}] book_id=${row.book_id ?? "none"} — ${row.title}`);
}
await client2.end();
