import "./load-env.ts";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const ids = process.argv.slice(2).map(Number).filter(Boolean);
const query =
  ids.length > 0
    ? "SELECT id, title, genre, cover_style_id, background_url IS NOT NULL AS has_bg, cover_url IS NOT NULL AS has_cover FROM draft_ebooks WHERE id = ANY($1::int[]) ORDER BY id"
    : "SELECT id, title, genre, cover_style_id, background_url IS NOT NULL AS has_bg, cover_url IS NOT NULL AS has_cover FROM draft_ebooks WHERE id >= 640 ORDER BY id";

const r = await client.query(query, ids.length > 0 ? [ids] : []);
for (const row of r.rows) {
  console.log(
    `#${row.id} | ${row.title} | ${row.genre} | style=${row.cover_style_id || "none"} | bg=${row.has_bg} cover=${row.has_cover}`,
  );
}
await client.end();
