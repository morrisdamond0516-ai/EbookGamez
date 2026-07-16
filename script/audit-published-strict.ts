import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import { coverFilenameFromUrl, localCoverPath } from "../server/coverStorage";

const PRODUCTION = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function onProduction(url: string): Promise<boolean> {
  const fn = coverFilenameFromUrl(url);
  if (!fn) return false;
  const enc = fn.split("/").map(encodeURIComponent).join("/");
  for (const base of [`${PRODUCTION}/objstore/covers/`, `${PRODUCTION}/uploads/covers/`]) {
    try {
      const res = await fetch(base + enc, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      if (res.ok) return true;
    } catch { /* */ }
  }
  return false;
}

const rows = await client.query(`
  SELECT id, title, cover_url, background_url, published_at, status
  FROM draft_ebooks
  WHERE status = 'published' OR published_at IS NOT NULL
  ORDER BY id
`);

let localOk = 0;
let prodOnly = 0;
let noUrl = 0;
let gone = 0;

for (const d of rows.rows) {
  const url = d.cover_url || d.background_url;
  if (!url) { noUrl++; continue; }
  const fn = coverFilenameFromUrl(url);
  const disk = fn && fs.existsSync(localCoverPath(fn)) && fs.statSync(localCoverPath(fn)).size > 0;
  if (disk) { localOk++; continue; }
  if (await onProduction(url)) { prodOnly++; continue; }
  gone++;
}

console.log("=== Published drafts — STRICT (real file check) ===");
console.log(`Total: ${rows.rowCount}`);
console.log(`Cover file on YOUR PC: ${localOk}`);
console.log(`Not local, but EXISTS on ebookgamez.com (can download): ${prodOnly}`);
console.log(`No URL in database: ${noUrl}`);
console.log(`GONE everywhere (no local, 404 on site): ${gone}`);
console.log(`\n→ ${localOk + prodOnly} of ${rows.rowCount} published books still HAVE covers (site or disk)`);
console.log(`→ ${gone + noUrl} truly lost on published drafts`);

await client.end();
