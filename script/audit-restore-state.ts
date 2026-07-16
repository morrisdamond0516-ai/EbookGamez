import "./load-env.ts";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const demoted = await c.query(`
  SELECT d.id, d.title, d.genre, d.status, d.published_at,
         b.id AS book_id, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.id IN (385, 661, 662, 670, 671, 700, 702, 727, 728)
     OR (d.status = 'ready' AND d.pdf_url IS NOT NULL AND d.genre ILIKE '%coloring%')
  ORDER BY d.id
`);

console.log("=== Target drafts / coloring ready ===");
for (const r of demoted.rows) {
  console.log(`#${r.id} [${r.status}] pub_at=${r.published_at} catalog=#${r.book_id} vis=${r.visible} ${(r.title||"").slice(0,50)}`);
}

const byTitle = await c.query(`
  SELECT b.id, b.title, b.visible, b.source_draft_id, d.status
  FROM books b
  LEFT JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE lower(b.title) LIKE '%kawaii%'
     OR lower(b.title) LIKE '%brain busters%'
     OR lower(b.title) LIKE '%puzzle planet%'
`);

console.log("\n=== Catalog by title ===");
for (const r of byTitle.rows) {
  console.log(`book #${r.id} draft #${r.source_draft_id} vis=${r.visible} [${r.status}] ${(r.title||"").slice(0,50)}`);
}

await c.end();
