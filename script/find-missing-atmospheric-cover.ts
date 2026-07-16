import "./load-env.ts";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const atmospheric = await c.query(`
  SELECT id, title, genre, status, cover_style_id, cover_url, background_url, updated_at
  FROM draft_ebooks
  WHERE cover_style_id ILIKE '%atmospheric%'
  ORDER BY id DESC
  LIMIT 40
`);
console.log("=== atmospheric style drafts ===");
for (const r of atmospheric.rows) {
  console.log(
    `#${r.id} | ${String(r.title).slice(0, 55)} | ${r.status} | style=${r.cover_style_id} | cover=${r.cover_url ? "Y" : "N"} | bg=${r.background_url ? "Y" : "N"} | upd=${r.updated_at}`,
  );
}

const missing = await c.query(`
  SELECT id, title, genre, status, cover_style_id, cover_url, background_url, updated_at
  FROM draft_ebooks
  WHERE (cover_url IS NULL OR cover_url = '')
    AND (background_url IS NULL OR background_url = '')
    AND cover_style_id IS NOT NULL AND cover_style_id <> ''
  ORDER BY updated_at DESC NULLS LAST, id DESC
  LIMIT 30
`);
console.log("\n=== style set but both cover URLs empty ===");
for (const r of missing.rows) {
  console.log(
    `#${r.id} | ${String(r.title).slice(0, 55)} | ${r.status} | style=${r.cover_style_id} | upd=${r.updated_at}`,
  );
}

const recentStandalone = await c.query(`
  SELECT id, title, cover_style_id, cover_url, background_url, updated_at
  FROM draft_ebooks
  WHERE cover_style_id ILIKE '%standalone%' OR cover_style_id ILIKE '%cinema%'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 25
`);
console.log("\n=== recent standalone/cinema ===");
for (const r of recentStandalone.rows) {
  console.log(
    `#${r.id} | ${String(r.title).slice(0, 50)} | style=${r.cover_style_id} | cover=${!!r.cover_url} bg=${!!r.background_url} | ${r.updated_at}`,
  );
}

await c.end();
