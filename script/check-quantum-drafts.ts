import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const rows = await client.query(`
  SELECT id, title, status, cover_url, background_url,
         length(content) AS content_len, published_at
  FROM draft_ebooks
  WHERE id IN (71, 140)
`);

for (const r of rows.rows) {
  console.log(JSON.stringify(r, null, 2));
}

await client.end();
