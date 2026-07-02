import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const tables = await client.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
);
const books = await client.query("SELECT COUNT(*)::int as n FROM books");
console.log("tables:", tables.rows.map((r) => r.tablename).join(", "));
console.log("books:", books.rows[0].n);
await client.end();
