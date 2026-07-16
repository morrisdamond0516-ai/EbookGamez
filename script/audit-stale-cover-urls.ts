/**
 * Find all stale cover URLs — DB has URL but file missing locally AND on production.
 * Run: npx tsx --import ./script/load-env.ts script/audit-stale-cover-urls.ts
 */
import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import { coverFilenameFromUrl, localCoverPath } from "../server/coverStorage";

const PRODUCTION = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const prodCache = new Map<string, boolean>();

async function onProduction(url: string): Promise<boolean> {
  const fn = coverFilenameFromUrl(url);
  if (!fn) return false;
  if (prodCache.has(fn)) return prodCache.get(fn)!;
  const enc = fn.split("/").map(encodeURIComponent).join("/");
  let ok = false;
  for (const base of [`${PRODUCTION}/objstore/covers/`, `${PRODUCTION}/uploads/covers/`]) {
    try {
      const res = await fetch(base + enc, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      if (res.ok) { ok = true; break; }
    } catch { /* */ }
  }
  prodCache.set(fn, ok);
  return ok;
}

type Row = { id: number; title: string; cover_url: string | null; background_url: string | null; kind: string; extra?: string };

async function checkRow(row: Row) {
  const urls = [row.cover_url, row.background_url].filter(Boolean) as string[];
  if (urls.length === 0) return null;

  let anyLocal = false;
  let anyProd = false;
  const missingFiles: string[] = [];

  for (const url of urls) {
    const fn = coverFilenameFromUrl(url);
    if (!fn) continue;
    const local = fs.existsSync(localCoverPath(fn)) && fs.statSync(localCoverPath(fn)).size > 0;
    if (local) anyLocal = true;
    else {
      missingFiles.push(fn);
      if (await onProduction(url)) anyProd = true;
    }
  }

  if (anyLocal || anyProd) return null; // recoverable — not fully stale

  return { ...row, missingFiles, primaryUrl: row.cover_url || row.background_url };
}

const drafts = await client.query(`
  SELECT id, title, cover_url, background_url, status
  FROM draft_ebooks
  WHERE cover_url IS NOT NULL OR background_url IS NOT NULL
  ORDER BY id
`);

const books = await client.query(`
  SELECT id, title, cover_url, visible, source_draft_id
  FROM books
  WHERE cover_url IS NOT NULL AND cover_url != ''
  ORDER BY id
`);

const stale: Array<Row & { missingFiles: string[]; primaryUrl: string | null }> = [];

for (const d of drafts.rows) {
  const hit = await checkRow({
    id: d.id,
    title: d.title,
    cover_url: d.cover_url,
    background_url: d.background_url,
    kind: "draft",
    extra: d.status,
  });
  if (hit) stale.push(hit);
}

const staleBooks: typeof stale = [];
for (const b of books.rows) {
  const hit = await checkRow({
    id: b.id,
    title: b.title,
    cover_url: b.cover_url,
    background_url: null,
    kind: "catalog",
    extra: `visible=${b.visible} draft=#${b.source_draft_id ?? "?"}`,
  });
  if (hit) staleBooks.push(hit);
}

const draftStale = stale.filter((s) => s.kind === "draft");
const onlyBooks = staleBooks.filter(
  (b) => !draftStale.some((d) => d.primaryUrl === b.primaryUrl && d.title === b.title),
);

console.log("=== STALE COVER URLs (no local file, 404 on production) ===\n");
console.log(`draft_ebooks: ${draftStale.length}`);
console.log(`books (catalog, not duped): ${onlyBooks.length}`);
console.log(`total unique stale rows: ${draftStale.length + onlyBooks.length}\n`);

if (draftStale.length > 0) {
  console.log("--- draft_ebooks ---");
  for (const s of draftStale) {
    console.log(`  #${s.id} [${s.extra}] ${s.title.slice(0, 50)}`);
    console.log(`    ${s.primaryUrl}`);
  }
}

if (onlyBooks.length > 0) {
  console.log("\n--- books (storefront) ---");
  for (const s of onlyBooks) {
    console.log(`  book #${s.id} [${s.extra}] ${s.title.slice(0, 50)}`);
    console.log(`    ${s.primaryUrl}`);
  }
}

if (draftStale.length === 0 && onlyBooks.length === 0) {
  console.log("No fully stale URLs found — every DB cover URL has a local file or exists on production.");
}

await client.end();
