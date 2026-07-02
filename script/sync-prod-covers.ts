/**
 * Sync published draft cover URLs from production and download missing image files.
 * Production is the source of truth for covers shown on ebookgamez.com.
 *
 * Run: npm run sync:prod-covers
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fetchCoverFromProduction } from "../server/coverProxy";
import { coverFilenameFromUrl } from "../server/coverStorage";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";

async function loginAdmin(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD not set in .env");
  const res = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Production login failed (${res.status})`);
  return (await res.json()).token;
}

/** Keep production paths as-is for local DB. */
function keepUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url;
}

async function coverExistsOnProduction(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${PRODUCTION_BASE}${url}`, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function catalogCoverForTitle(title: string): Promise<string | null> {
  const res = await fetch(`${PRODUCTION_BASE}/api/books?limit=600`);
  if (!res.ok) return null;
  const books: { title: string; coverUrl: string }[] = await res.json();
  const norm = title.trim().toLowerCase();
  const exact = books.find((b) => b.title.trim().toLowerCase() === norm);
  if (exact?.coverUrl) return exact.coverUrl;
  const prefix = books.find(
    (b) =>
      norm.length >= 15 &&
      (b.title.trim().toLowerCase().startsWith(norm) || norm.startsWith(b.title.trim().toLowerCase())),
  );
  return prefix?.coverUrl ?? null;
}

async function resolveProdCover(
  draft: { title: string; coverUrl?: string; backgroundUrl?: string },
): Promise<{ cover: string | null; bg: string | null; note?: string }> {
  let cover = keepUrl(draft.coverUrl);
  let bg = keepUrl(draft.backgroundUrl);

  if (cover && !(await coverExistsOnProduction(cover))) {
    if (bg && bg !== cover && (await coverExistsOnProduction(bg))) {
      cover = bg;
    } else {
      const fallback = await catalogCoverForTitle(draft.title);
      if (fallback && (await coverExistsOnProduction(fallback))) {
        return { cover: fallback, bg: bg && (await coverExistsOnProduction(bg)) ? bg : fallback, note: "catalog fallback" };
      }
    }
  }

  if (!cover && bg && (await coverExistsOnProduction(bg))) cover = bg;
  if (!cover) {
    const fallback = await catalogCoverForTitle(draft.title);
    if (fallback) return { cover: fallback, bg: fallback, note: "catalog only" };
  }

  return { cover, bg };
}

const token = await loginAdmin();
console.log(`Logged in to ${PRODUCTION_BASE}`);

const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts?status=published`, {
  headers: { "x-admin-token": token },
});
if (!res.ok) throw new Error(`Failed to list production drafts: ${res.status}`);
const prodDrafts: { id: number; title: string; coverUrl?: string; backgroundUrl?: string }[] = await res.json();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const localRows = await client.query(
  `SELECT id, title, cover_url, background_url FROM draft_ebooks WHERE status = 'published'`,
);
const localById = new Map(localRows.rows.map((r) => [r.id, r]));

let urlUpdates = 0;
let filesDownloaded = 0;
let filesFailed = 0;
const mismatches: string[] = [];

for (const prod of prodDrafts) {
  const local = localById.get(prod.id);
  if (!local) continue;

  const prodCover = keepUrl(prod.coverUrl);
  const prodBg = keepUrl(prod.backgroundUrl);

  const resolved = await resolveProdCover(prod);
  const finalCover = resolved.cover;
  const finalBg = resolved.bg;

  if (local.cover_url !== finalCover || local.background_url !== finalBg) {
    mismatches.push(
      `#${prod.id} "${prod.title?.slice(0, 50)}"${resolved.note ? ` (${resolved.note})` : ""}\n` +
      `  local:  cover=${local.cover_url || "none"}\n` +
      `  prod:   cover=${prodCover || "none"}${prodCover !== finalCover ? ` → ${finalCover}` : ""}`,
    );
    await client.query(
      `UPDATE draft_ebooks SET cover_url = $1, background_url = $2 WHERE id = $3`,
      [finalCover, finalBg, prod.id],
    );
    urlUpdates++;
  }

  for (const url of [finalCover, finalBg]) {
    if (!url) continue;
    const fn = coverFilenameFromUrl(url);
    if (!fn) continue;
    const fp = path.join(process.cwd(), "uploads", "covers", fn);
    if (fs.existsSync(fp) && fs.statSync(fp).size > 0) continue;
    const buf = await fetchCoverFromProduction(fn, true);
    if (buf) filesDownloaded++;
    else filesFailed++;
  }
}

console.log(`\nCover URL updates from production: ${urlUpdates}`);
console.log(`Files downloaded: ${filesDownloaded}, failed: ${filesFailed}`);

if (mismatches.length > 0) {
  console.log(`\nUpdated drafts (first 15):`);
  for (const m of mismatches.slice(0, 15)) console.log(m);
  if (mismatches.length > 15) console.log(`... and ${mismatches.length - 15} more`);
}

await client.end();
console.log("\nDone. Hard refresh AI Studio to see covers.");
