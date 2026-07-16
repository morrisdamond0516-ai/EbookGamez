import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import { LOST_COVER_REGEN_IDS } from "../shared/coverConstants";
import { coverFilenameFromUrl, localCoverPath } from "../server/coverStorage";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const ids = Array.from(LOST_COVER_REGEN_IDS).sort((a, b) => a - b);
const r = await c.query(
  `SELECT id, title, cover_url, background_url, cover_style_id, status
   FROM draft_ebooks WHERE id = ANY($1::int[]) ORDER BY id`,
  [ids],
);

let onDisk = 0;
let hasUrl = 0;
let noUrl = 0;

console.log("=== LOST COVER BATCH — actual file status ===\n");

for (const row of r.rows) {
  const url = row.cover_url || row.background_url;
  if (!url) {
    noUrl++;
    console.log(`#${row.id} ${row.title.slice(0, 40)} | NO URL | style: ${row.cover_style_id || "none"} | ${row.status}`);
    continue;
  }
  hasUrl++;
  const fn = coverFilenameFromUrl(url);
  const disk = fn && fs.existsSync(localCoverPath(fn)) && fs.statSync(localCoverPath(fn)).size > 0;
  if (disk) onDisk++;
  console.log(
    `#${row.id} ${row.title.slice(0, 40)} | ${disk ? "ON DISK" : "URL but FILE MISSING"} | ${url.slice(0, 55)} | ${row.status}`,
  );
}

console.log(`\n--- Summary (${ids.length} IDs) ---`);
console.log(`Restored on local disk: ${onDisk}/${ids.length}`);
console.log(`DB has URL but file missing: ${hasUrl - onDisk}`);
console.log(`No cover URL at all: ${noUrl}`);
console.log(`\nCovers are NOT back unless you regenerate them in Cover Review.`);

await c.end();
