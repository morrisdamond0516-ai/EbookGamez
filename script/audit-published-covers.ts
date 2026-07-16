/**
 * Published books cover health — local disk, DB URL, production fetch.
 * Run: npx tsx --import ./script/load-env.ts script/audit-published-covers.ts
 */
import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import { coverFilenameFromUrl, localCoverPath, draftCoverLikelyReachable } from "../server/coverStorage";

const PRODUCTION = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function prodExists(filename: string): Promise<boolean> {
  const enc = filename.split("/").map(encodeURIComponent).join("/");
  for (const base of [`${PRODUCTION}/objstore/covers/`, `${PRODUCTION}/uploads/covers/`]) {
    try {
      const res = await fetch(base + enc, { method: "HEAD", signal: AbortSignal.timeout(12_000) });
      if (res.ok) return true;
    } catch { /* next */ }
  }
  return false;
}

const publishedDrafts = await client.query(`
  SELECT id, title, status, cover_url, background_url, published_at
  FROM draft_ebooks WHERE status = 'published' OR published_at IS NOT NULL
  ORDER BY id
`);

const catalogBooks = await client.query(`
  SELECT id, title, cover_url, visible, source_draft_id
  FROM books WHERE visible = true ORDER BY id
`);

let pubNoReach = 0;
let pubNoUrl = 0;
let pubLocalOk = 0;
let pubProdOk = 0;
let pubGoneEverywhere = 0;

const goneList: string[] = [];
const recoverableList: string[] = [];

console.log("=== PUBLISHED DRAFTS (AI Studio) ===\n");

for (const d of publishedDrafts.rows) {
  const url = d.cover_url || d.background_url;
  const reachable = draftCoverLikelyReachable(d.cover_url, d.background_url, { publishedAt: d.published_at });
  if (!url) {
    pubNoUrl++;
    goneList.push(`#${d.id} ${d.title.slice(0, 45)} — NO URL`);
    continue;
  }
  if (reachable) {
    pubLocalOk++;
    continue;
  }
  pubNoReach++;
  const fn = coverFilenameFromUrl(url);
  if (!fn) {
    goneList.push(`#${d.id} ${d.title.slice(0, 45)} — bad URL`);
    continue;
  }
  const onProd = await prodExists(fn);
  if (onProd) {
    pubProdOk++;
    recoverableList.push(`#${d.id} ${d.title.slice(0, 40)} — on production, can pull`);
  } else {
    pubGoneEverywhere++;
    goneList.push(`#${d.id} ${d.title.slice(0, 45)} — 404 production + no local`);
  }
}

console.log(`Total published drafts: ${publishedDrafts.rowCount}`);
console.log(`Reachable locally (or proxy): ${pubLocalOk}`);
console.log(`No cover URL at all: ${pubNoUrl}`);
console.log(`Has URL, missing locally but ON PRODUCTION (recoverable): ${pubProdOk}`);
console.log(`Gone everywhere (404 prod + no local): ${pubGoneEverywhere}`);

console.log("\n=== STOREFRONT (visible catalog books) ===\n");

let catOk = 0;
let catMissing = 0;
let catProdRecover = 0;
let catGone = 0;
const storefrontGone: string[] = [];

for (const b of catalogBooks.rows) {
  const url = b.cover_url;
  if (!url?.trim()) {
    catMissing++;
    storefrontGone.push(`book #${b.id} draft #${b.source_draft_id} ${b.title.slice(0, 40)} — NO URL`);
    continue;
  }
  const fn = coverFilenameFromUrl(url);
  const local = fn && fs.existsSync(localCoverPath(fn)) && fs.statSync(localCoverPath(fn)).size > 0;
  if (local || url.startsWith("/objstore/")) {
    // objstore trusted on Replit; locally check prod
    if (local) {
      catOk++;
      continue;
    }
  }
  if (fn && fs.existsSync(localCoverPath(fn))) {
    catOk++;
    continue;
  }
  const onProd = fn ? await prodExists(fn) : false;
  if (onProd) {
    catProdRecover++;
  } else {
    catGone++;
    storefrontGone.push(`book #${b.id} ${b.title.slice(0, 40)} — 404`);
  }
}

console.log(`Visible catalog books: ${catalogBooks.rowCount}`);
console.log(`Cover on local disk: ${catOk}`);
console.log(`No URL: ${catMissing}`);
console.log(`Recoverable from production: ${catProdRecover}`);
console.log(`Gone on storefront (404): ${catGone}`);

if (recoverableList.length > 0 && recoverableList.length <= 15) {
  console.log("\n--- Recoverable from production (sample) ---");
  recoverableList.slice(0, 15).forEach((l) => console.log(" ", l));
}
if (goneList.length > 0 && goneList.length <= 20) {
  console.log("\n--- Published drafts with no cover anywhere ---");
  goneList.forEach((l) => console.log(" ", l));
} else if (goneList.length > 20) {
  console.log(`\n--- ${goneList.length} published drafts with no cover (showing first 15) ---`);
  goneList.slice(0, 15).forEach((l) => console.log(" ", l));
}

if (storefrontGone.length > 0 && storefrontGone.length <= 15) {
  console.log("\n--- Storefront books missing covers ---");
  storefrontGone.forEach((l) => console.log(" ", l));
}

await client.end();
