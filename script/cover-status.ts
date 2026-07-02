import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const summary = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE cover_url LIKE '/objstore/%')::int AS objstore,
    COUNT(*) FILTER (WHERE cover_url LIKE '/uploads/%')::int AS uploads,
    COUNT(*) FILTER (WHERE cover_url NOT LIKE '/objstore/%' AND cover_url NOT LIKE '/uploads/%')::int AS other
  FROM books
`);
console.log("Cover URL summary:", summary.rows[0]);

const sample = await client.query(`
  SELECT id, title, cover_url FROM books ORDER BY id LIMIT 5
`);
console.log("\nSample books:");
for (const row of sample.rows) {
  console.log(`  [${row.id}] ${row.title}`);
  console.log(`       ${row.cover_url}`);
}

await client.end();
