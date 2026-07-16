import "./load-env.ts";
import pg from "pg";
import fs from "fs";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const r = await client.query(`
  SELECT id, title, cover_style_id,
    cover_url, background_url,
    overlay_approved, status
  FROM draft_ebooks
  WHERE id BETWEEN 707 AND 728
  ORDER BY id
`);

function fileStatus(url: string | null): string {
  if (!url) return "no-url";
  const m = String(url).match(/covers\/(.+)$/);
  if (!m) return "bad-path";
  const p = `uploads/covers/${m[1]}`;
  return fs.existsSync(p) ? "on-disk" : "FILE-MISSING";
}

for (const row of r.rows) {
  const cover = row.cover_url ? String(row.cover_url).slice(0, 60) : null;
  const bg = row.background_url ? String(row.background_url).slice(0, 60) : null;
  const coverDisk = fileStatus(row.cover_url);
  const bgDisk = fileStatus(row.background_url);
  console.log(
    `#${row.id} | ${row.title}\n` +
      `  style=${row.cover_style_id || "none"} overlay=${row.overlay_approved} status=${row.status}\n` +
      `  cover=${cover || "MISSING"} (${coverDisk})\n` +
      `  bg=${bg || "MISSING"} (${bgDisk})\n`,
  );
}

await client.end();
