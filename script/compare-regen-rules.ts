import "./load-env.ts";
import pg from "pg";
import { draftCoverLikelyReachable, LOST_COVER_REGEN_IDS } from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const rows = await client.query(`
  SELECT id, title, cover_url, background_url, cover_style_id, published_at
  FROM draft_ebooks ORDER BY id
`);

function oldBroadRegen(d: typeof rows.rows[0]) {
  if (draftCoverLikelyReachable(d.cover_url, d.background_url)) return false;
  if (d.id >= 646 && d.cover_style_id) return true;
  if (LOST_COVER_REGEN_IDS.has(d.id)) return true;
  return false;
}

function newNarrowRegen(d: typeof rows.rows[0]) {
  if (draftCoverLikelyReachable(d.cover_url, d.background_url)) return false;
  return LOST_COVER_REGEN_IDS.has(d.id);
}

let oldCount = 0, newCount = 0;
const oldIds: number[] = [];
for (const d of rows.rows) {
  if (oldBroadRegen(d)) { oldCount++; oldIds.push(d.id); }
  if (newNarrowRegen(d)) newCount++;
}

console.log(`OLD broad regen (id>=646 + style, no file): ${oldCount}`);
console.log(`NEW narrow regen (LOST_COVER_REGEN_IDS only): ${newCount}`);
console.log(`\nOLD would flag but NEW would not: ${oldCount - newCount} drafts`);
const onlyOld = oldIds.filter(id => !LOST_COVER_REGEN_IDS.has(id));
console.log(`Sample IDs only in OLD rule: ${onlyOld.slice(0, 15).join(", ")}...`);

await client.end();
