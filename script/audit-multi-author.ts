/** Multi-author / dialogue pipeline status for active drafts */
import "./load-env.ts";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

function pipelineStatus(outline: string | null, content: string | null) {
  const o = outline || "";
  const t = content || "";
  const hasMA =
    o.includes("Story Architect") || t.includes("Story Architect") ||
    o.includes("Technique Map") || o.includes("technique map");
  const outlineStructured = o.trim().length > 200 && /##\s*(Title|Premise|Hook|Chapter)/i.test(o);
  const words = t ? t.split(/\s+/).length : 0;
  const chapters = t ? (t.match(/##\s*Chapter\s+\d+/gi) || []).length : 0;
  const inferredMA = outlineStructured && chapters >= 5 && words >= 10000;
  if (hasMA) return "multi-author (markers)";
  if (inferredMA) return "multi-author (inferred)";
  if (words > 500 && !hasMA) return "pre-system or no markers";
  if (words === 0) return "not started";
  return "partial / unknown";
}

const rows = await c.query(`
  SELECT id, title, status, genre,
         length(COALESCE(outline,''))::int AS olen,
         length(COALESCE(content,''))::int AS clen
  FROM draft_ebooks
  WHERE id >= 707 AND id <= 728
  ORDER BY id
`);

console.log("=== Research batch #707–728 — writing pipeline ===\n");
for (const r of rows.rows) {
  const full = await c.query(`SELECT outline, content FROM draft_ebooks WHERE id = $1`, [r.id]);
  const { outline, content } = full.rows[0];
  const status = pipelineStatus(outline, content);
  const ch = content ? (content.match(/##\s*Chapter\s+\d+/gi) || []).length : 0;
  console.log(`#${r.id} [${r.status}] ${r.title.slice(0, 40)}`);
  console.log(`  pipeline: ${status} | ${ch} chapters | ${r.clen} chars`);
}

const active = await c.query(`
  SELECT id, title, status FROM draft_ebooks WHERE status IN ('generating', 'draft') AND id >= 640 ORDER BY id DESC LIMIT 5
`);
console.log("\n=== Currently writing ===");
for (const r of active.rows) {
  const full = await c.query(`SELECT outline, content FROM draft_ebooks WHERE id = $1`, [r.id]);
  console.log(`#${r.id} [${r.status}] ${r.title} → ${pipelineStatus(full.rows[0].outline, full.rows[0].content)}`);
}

await c.end();
