import "./load-env.ts";
import pg from "pg";
import { getIllustrationNeeds } from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const needs = await getIllustrationNeeds();
const needsById = new Map(needs.map((n) => [n.id, n]));

for (const id of [706, 707, 724, 725, 726, 727, 728]) {
  const r = await c.query(
    `SELECT id, title, genre, status, cover_url, background_url, description, content FROM draft_ebooks WHERE id = $1`,
    [id],
  );
  if (!r.rows[0]) continue;
  const d = r.rows[0];
  const content = d.content || "";
  const all = [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)];
  const pending = all.filter((m) => {
    const src = m[1].trim();
    return !(src.startsWith("/") || src.startsWith("http"));
  });
  const resolved = all.filter((m) => {
    const src = m[1].trim();
    return src.startsWith("/") || src.startsWith("http");
  });
  const coverOk = draftHasPublishableCover(d);
  const need = needsById.get(id);
  console.log(`#${d.id} ${d.genre} [${d.status}] ${(d.title || "").slice(0, 40)}`);
  console.log(`  markers: ${all.length} pending: ${pending.length} resolved: ${resolved.length} cover_ok: ${coverOk}`);
  console.log(`  illustration needs UI: ${need ? need.reason : "not listed"}`);
}

await c.end();
