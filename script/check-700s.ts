import "./load-env.ts";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const r = await client.query(`
  SELECT id, title, status, published_at,
         length(COALESCE(content,''))::int AS content_len,
         cover_url IS NOT NULL AS has_cover,
         background_url IS NOT NULL AS has_bg
  FROM draft_ebooks
  WHERE id BETWEEN 700 AND 730
  ORDER BY id
`);

console.log("=== Drafts #700-730 ===\n");
for (const row of r.rows) {
  console.log(
    `#${row.id} [${row.status}] ${row.title.slice(0, 42)} | story: ${row.content_len} chars | pub: ${row.published_at ? "yes" : "no"} | cover: ${row.has_cover} bg: ${row.has_bg}`,
  );
}

const maxId = await client.query(`SELECT MAX(id)::int AS m FROM draft_ebooks`);
console.log(`\nMax draft id: ${maxId.rows[0].m}`);

await client.end();
