import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import { objStoreExists } from "../server/objectStorage";

const ids = [385, 332, 437, 550, 679, 680];
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

for (const id of ids) {
  const r = await c.query(
    `SELECT id, title, genre, status, published_at, pdf_url, content FROM draft_ebooks WHERE id = $1`,
    [id],
  );
  const d = r.rows[0];
  if (!d) continue;
  const content = d.content || "";
  const pages = (content.match(/\*\*Page\s+\d+:\*\*/gi) || []).length;
  const pageDir = `uploads/coloring-pages/${id}`;
  const local = fs.existsSync(pageDir)
    ? fs.readdirSync(pageDir).filter((f) => f.endsWith(".png")).length
    : 0;
  const gcs = await objStoreExists(`public/coloring-pages/${id}/page-001.png`);
  const catalog = await c.query(`SELECT id, visible FROM books WHERE source_draft_id = $1`, [id]);
  console.log(`#${d.id} [${d.status}] ${d.title}`);
  console.log(`  published_at: ${d.published_at}  pdf: ${!!d.pdf_url}`);
  console.log(`  page markers in content: ${pages}  local png: ${local}  gcs page-001: ${gcs}`);
  console.log(`  catalog: ${catalog.rows.map((b) => `#${b.id} visible=${b.visible}`).join(", ") || "none"}`);
}

await c.end();
