import "./load-env.ts";
import pg from "pg";
import { getIllustrationNeeds } from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";
import { parseCoverDeferredFromDescription } from "@shared/coverMetadata";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const needs = await getIllustrationNeeds();

const rows = await c.query(`
  SELECT id, title, genre, status, cover_url, background_url, description, content
  FROM draft_ebooks
  WHERE genre ILIKE '%activity%'
     OR id BETWEEN 706 AND 728
  ORDER BY id
`);

console.log("=== Activity + research batch illustration state ===\n");
for (const d of rows.rows) {
  const content = d.content || "";
  const all = [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)];
  const pending = all.filter((m) => {
    const s = m[1].trim();
    return !(s.startsWith("/") || s.startsWith("http"));
  });
  const coverOk = draftHasPublishableCover(d);
  const deferred = !!parseCoverDeferredFromDescription(d.description);
  const need = needs.find((n) => n.id === d.id);
  console.log(`#${d.id} [${d.status}] ${d.genre}`);
  console.log(`  ${(d.title || "").slice(0, 55)}`);
  console.log(`  cover: ${!!(d.cover_url || d.background_url)} publishable: ${coverOk} deferred: ${deferred}`);
  console.log(`  illus: ${all.length} total, ${pending.length} pending, ${all.length - pending.length} done`);
  console.log(`  needs queue: ${need ? need.reason + " (" + need.actionType + ")" : "—"}`);
  console.log();
}

// Ready demoted - why not republished
const demoted = await c.query(`
  SELECT d.id, d.title, d.status, b.id AS book_id, b.source_draft_id, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.status = 'ready' AND d.id IN (
    SELECT id FROM draft_ebooks WHERE status = 'ready' AND (cover_url IS NOT NULL OR background_url IS NOT NULL)
  )
  ORDER BY d.id DESC
  LIMIT 20
`);
console.log("=== Republish blockers (ready + cover, source_draft_id link) ===\n");
for (const r of demoted.rows) {
  console.log(`#${r.id} ${r.title?.slice(0, 40)} | catalog link src_draft=${r.source_draft_id ?? "NULL"} book=#${r.book_id ?? "none"} visible=${r.visible}`);
}

await c.end();
