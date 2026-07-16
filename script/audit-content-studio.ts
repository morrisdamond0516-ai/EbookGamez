/**
 * Content Studio health check — stories, missing drafts, cover state.
 * Run: npx tsx --import ./script/load-env.ts script/audit-content-studio.ts
 */
import "./load-env.ts";
import pg from "pg";
import { draftNeedsCoverRegeneration, draftCoverLikelyReachable, LOST_COVER_REGEN_IDS } from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const total = await client.query(`SELECT COUNT(*)::int AS n FROM draft_ebooks`);
console.log(`Total drafts in database: ${total.rows[0].n}`);

const lostBatch = await client.query(`
  SELECT id, title, status,
         CASE WHEN content IS NULL OR length(content) < 100 THEN 'EMPTY/MINIMAL' ELSE 'HAS STORY' END AS story,
         length(COALESCE(content,''))::int AS content_len,
         cover_url IS NOT NULL AS has_cover_url,
         cover_style_id
  FROM draft_ebooks
  WHERE id = ANY($1::int[])
  ORDER BY id
`, [Array.from(LOST_COVER_REGEN_IDS)]);

console.log(`\n=== Lost cover batch (${LOST_COVER_REGEN_IDS.size} IDs) ===`);
let emptyStory = 0;
for (const r of lostBatch.rows) {
  if (r.story !== "HAS STORY") emptyStory++;
  console.log(`#${r.id} ${r.title.slice(0, 45)} | story: ${r.story} (${r.content_len} chars) | style: ${r.cover_style_id || "none"}`);
}
console.log(`Story preserved: ${lostBatch.rowCount - emptyStory}/${lostBatch.rowCount}`);

const noStory = await client.query(`
  SELECT id, title, status, published_at
  FROM draft_ebooks
  WHERE (content IS NULL OR length(content) < 100)
    AND status != 'idea'
    AND id >= 640
  ORDER BY id
  LIMIT 30
`);
console.log(`\n=== Recent drafts (id>=640) with little/no story text ===`);
for (const r of noStory.rows) console.log(`  #${r.id} ${r.title} (${r.status})`);

const regenFlags = await client.query(`SELECT id, title, cover_url, background_url, cover_style_id, published_at FROM draft_ebooks ORDER BY id`);
let awaiting = 0, regen = 0, placers = 0;
for (const d of regenFlags.rows) {
  const reachable = draftCoverLikelyReachable(d.cover_url, d.background_url);
  const needs = draftNeedsCoverRegeneration(d);
  const hasImg = reachable && !!(d.cover_url || d.background_url);
  if (needs) { awaiting++; regen++; }
  else if (!d.cover_style_id && !hasImg) { awaiting++; placers++; }
}
console.log(`\n=== Awaiting queue (server logic now) ===`);
console.log(`  Total awaiting: ${awaiting} (${regen} need regen, ${placers} title placers)`);

const styleNoImg = await client.query(`
  SELECT COUNT(*)::int AS n FROM draft_ebooks
  WHERE cover_style_id IS NOT NULL AND cover_style_id != ''
    AND (cover_url IS NULL OR cover_url = '')
    AND (background_url IS NULL OR background_url = '')
    AND id NOT IN (${Array.from(LOST_COVER_REGEN_IDS).join(",")})
`);
console.log(`\nOther drafts with style but no cover URL (NOT in regen list): ${styleNoImg.rows[0].n}`);
console.log(`(These should NOT appear in Awaiting — old published books without draft covers)`);

await client.end();
