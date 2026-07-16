/**
 * Check whether cover URLs in the DB still exist on production object storage.
 * Run: npx tsx --import ./script/load-env.ts script/probe-prod-covers.ts
 */
import "./load-env.ts";
import pg from "pg";

const PRODUCTION_BASE = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const r = await client.query(`
  SELECT id, title, cover_url, background_url
  FROM draft_ebooks
  WHERE id BETWEEN 707 AND 728
  ORDER BY id
`);

let onProd = 0;
let missing = 0;
let noUrl = 0;

for (const row of r.rows) {
  const urls = [row.cover_url, row.background_url].filter(Boolean) as string[];
  if (urls.length === 0) {
    console.log(`#${row.id} ${row.title} — no URLs in DB`);
    noUrl++;
    continue;
  }
  const url = urls[0];
  const fn = url.match(/covers\/(.+)$/)?.[1];
  try {
    const res = await fetch(`${PRODUCTION_BASE}${url}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      console.log(`#${row.id} ${row.title} — OK on production (${res.status})`);
      onProd++;
    } else {
      console.log(`#${row.id} ${row.title} — MISSING on production (${res.status}) ${fn}`);
      missing++;
    }
  } catch (e: any) {
    console.log(`#${row.id} ${row.title} — fetch error: ${e.message}`);
    missing++;
  }
}

console.log(`\nSummary: ${onProd} on production, ${missing} missing/error, ${noUrl} no URL in DB`);
await client.end();
