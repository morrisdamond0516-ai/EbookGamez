/**
 * Compare published draft cover URLs between local DB and production.
 * Run: NODE_OPTIONS=--use-system-ca npx tsx --env-file=.env script/compare-prod-covers.ts
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fetchCoverFromProduction } from "../server/coverProxy";
import { coverFilenameFromUrl } from "../server/coverStorage";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";

async function loginAdmin(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD not set");
  const res = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return (await res.json()).token;
}

function norm(url: string | null | undefined): string {
  if (!url) return "";
  return url.replace("/objstore/covers/", "/uploads/covers/");
}

const token = await loginAdmin();
console.log("Fetching production published drafts...\n");

const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts?status=published`, {
  headers: { "x-admin-token": token },
});
if (!res.ok) throw new Error(`List failed: ${res.status}`);
const prodDrafts: { id: number; title: string; coverUrl?: string; backgroundUrl?: string }[] = await res.json();
const prodById = new Map(prodDrafts.map((d) => [d.id, d]));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const localRows = await client.query(`
  SELECT id, title, cover_url, background_url FROM draft_ebooks WHERE status = 'published'
`);

const mismatches: { id: number; title: string; local: string; prod: string }[] = [];
const missingLocal: { id: number; title: string; prodCover: string }[] = [];

for (const row of localRows.rows) {
  const prod = prodById.get(row.id);
  if (!prod) continue;

  const localCover = norm(row.cover_url);
  const prodCover = norm(prod.coverUrl);
  const localBg = norm(row.background_url);
  const prodBg = norm(prod.backgroundUrl);

  if (localCover !== prodCover || localBg !== prodBg) {
    mismatches.push({
      id: row.id,
      title: row.title,
      local: `cover=${row.cover_url || "none"} bg=${row.background_url || "none"}`,
      prod: `cover=${prod.coverUrl || "none"} bg=${prod.backgroundUrl || "none"}`,
    });
  }

  const displayUrl = prod.coverUrl || prod.backgroundUrl;
  if (displayUrl) {
    const fn = coverFilenameFromUrl(displayUrl);
    if (fn) {
      const fp = path.join(process.cwd(), "uploads", "covers", fn);
      if (!fs.existsSync(fp)) {
        missingLocal.push({ id: row.id, title: row.title, prodCover: displayUrl });
      }
    }
  }
}

console.log(`Cover URL mismatches (local vs production): ${mismatches.length}`);
for (const m of mismatches.slice(0, 20)) {
  console.log(`\n[#${m.id}] ${m.title?.slice(0, 55)}`);
  console.log(`  LOCAL: ${m.local}`);
  console.log(`  PROD:  ${m.prod}`);
}
if (mismatches.length > 20) console.log(`\n... and ${mismatches.length - 20} more`);

console.log(`\n\nMissing local files for production cover URLs: ${missingLocal.length}`);

// Fix: sync cover URLs from production and download files
let fixed = 0;
let downloaded = 0;

for (const m of mismatches) {
  const prod = prodById.get(m.id)!;
  await client.query(
    `UPDATE draft_ebooks SET cover_url = $1, background_url = $2 WHERE id = $3`,
    [
      prod.coverUrl ? norm(prod.coverUrl) : null,
      prod.backgroundUrl ? norm(prod.backgroundUrl) : null,
      m.id,
    ],
  );
  fixed++;
}

for (const { prodCover } of missingLocal) {
  for (const url of [prodCover]) {
    const fn = coverFilenameFromUrl(url);
    if (!fn) continue;
    const fp = path.join(process.cwd(), "uploads", "covers", fn);
    if (fs.existsSync(fp)) continue;
    const buf = await fetchCoverFromProduction(fn, true);
    if (buf) downloaded++;
  }
}

// Also download files for mismatched drafts we just fixed
for (const m of mismatches) {
  const prod = prodById.get(m.id)!;
  for (const url of [prod.coverUrl, prod.backgroundUrl]) {
    if (!url) continue;
    const fn = coverFilenameFromUrl(url);
    if (!fn) continue;
    const fp = path.join(process.cwd(), "uploads", "covers", fn);
    if (fs.existsSync(fp)) continue;
    const buf = await fetchCoverFromProduction(fn, true);
    if (buf) downloaded++;
  }
}

console.log(`\nFixed ${fixed} draft cover URL(s) from production`);
console.log(`Downloaded ${downloaded} cover file(s)`);

await client.end();
