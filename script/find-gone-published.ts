import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import { coverFilenameFromUrl, localCoverPath } from "../server/coverStorage";

const PRODUCTION = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

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

const rows = await c.query(`
  SELECT id, title, cover_url, background_url, status
  FROM draft_ebooks WHERE status = 'published' OR published_at IS NOT NULL
`);

for (const d of rows.rows) {
  const url = d.cover_url || d.background_url;
  if (!url) { console.log(`#${d.id} NO URL — ${d.title}`); continue; }
  const fn = coverFilenameFromUrl(url);
  const disk = fn && fs.existsSync(localCoverPath(fn));
  const prod = await onProduction(url);
  if (!disk && !prod) console.log(`#${d.id} GONE — ${d.title} | ${url}`);
}

await c.end();
