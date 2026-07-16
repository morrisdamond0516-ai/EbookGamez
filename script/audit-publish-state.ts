import "./load-env.ts";
import pg from "pg";
import { draftCoverLikelyReachable } from "../server/coverStorage";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const total = await c.query(`SELECT COUNT(*)::int AS n FROM draft_ebooks`);
const allWithStory = await c.query(`SELECT COUNT(*)::int AS n FROM draft_ebooks WHERE length(COALESCE(content,'')) > 100`);
const pubNoCover = await c.query(`
  SELECT COUNT(*)::int AS n FROM draft_ebooks
  WHERE status = 'published'
    AND (cover_url IS NULL OR cover_url = '')
    AND (background_url IS NULL OR background_url = '')
`);
const recent = await c.query(`
  SELECT id, title, status, cover_url, background_url, published_at,
         length(COALESCE(content,''))::int AS clen
  FROM draft_ebooks WHERE status = 'published' AND id >= 720
  ORDER BY id
`);

console.log("=== INVENTORY ===");
console.log(`Total draft rows: ${total.rows[0].n}`);
console.log(`With story text: ${allWithStory.rows[0].n}`);
console.log(`Published with no cover URL at all: ${pubNoCover.rows[0].n}`);
console.log("\n=== Recently published (id>=720) ===");
for (const r of recent.rows) {
  const reach = draftCoverLikelyReachable(r.cover_url, r.background_url, { publishedAt: r.published_at });
  console.log(`#${r.id} ${r.title.slice(0, 45)} | story ${r.clen} chars | cover URL: ${!!(r.cover_url || r.background_url)} | reachable: ${reach}`);
}

const catalog = await c.query(`
  SELECT id, title, cover_url, visible, source_draft_id
  FROM books
  WHERE source_draft_id IN (726, 727, 728)
     OR lower(title) LIKE '%dragon academy trials%'
     OR lower(title) LIKE '%brain busters%'
`);
console.log("\n=== Catalog rows for recent batch ===");
for (const b of catalog.rows) {
  console.log(` book #${b.id} draft #${b.source_draft_id} visible=${b.visible} cover=${b.cover_url || "(none)"}`);
}

await c.end();
