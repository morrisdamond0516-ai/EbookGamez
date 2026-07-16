import "./load-env.ts";
import pg from "pg";
import { getIllustrationNeeds } from "../server/contentStudio";
import { countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// Sample older library books flagged in queue
const ids = [302, 333, 369, 661, 662, 385];
for (const id of ids) {
  const r = await c.query(
    `SELECT id, title, genre, status, published_at, pdf_url FROM draft_ebooks WHERE id=$1`,
    [id],
  );
  const d = r.rows[0];
  if (!d) continue;
  const content = (await c.query(`SELECT content FROM draft_ebooks WHERE id=$1`, [id])).rows[0]?.content || "";
  const pending = countUnprocessedIllustrationMarkers(content);
  const resolved = (content.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  const pages = (content.match(/\*\*Page\s+\d+:\*\*/gi) || []).length;
  const cat = await c.query(`SELECT id, visible FROM books WHERE source_draft_id=$1`, [id]);
  console.log(`#${id} [${d.status}] ${(d.title||"").slice(0,40)}`);
  console.log(`  pending:${pending} resolved:${resolved} pages:${pages} pdf:${!!d.pdf_url} pub_at:${d.published_at}`);
  console.log(`  catalog: ${cat.rows.map(b=>`#${b.id} vis=${b.visible}`).join(",") || "none"}`);
}

const needs = await getIllustrationNeeds();
console.log(`\ngetIllustrationNeeds total: ${needs.length}`);

await c.end();
