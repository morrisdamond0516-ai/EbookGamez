/**
 * Summarize local published drafts: synced vs needs push.
 * Usage: node script/run-tsx.mjs script/count-prod-pending.ts
 */
import "./load-env.ts";
import pg from "pg";
import { assessProdSyncStatus } from "../shared/prodSyncMetadata.ts";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT id, title, status, content, cover_url AS "coverUrl",
         background_url AS "backgroundUrl", description
  FROM draft_ebooks
  WHERE status = 'published' AND content IS NOT NULL
  ORDER BY id
`);

const counts: Record<string, number> = {};
const titleRepairs: { id: number; title: string }[] = [];
const otherPending: { id: number; title: string; reason: string }[] = [];

for (const d of rows) {
  const s = assessProdSyncStatus(d);
  counts[s.reason] = (counts[s.reason] || 0) + 1;
  if (s.reason === "title_repair") titleRepairs.push({ id: d.id, title: d.title });
  else if (s.needsProdPush) otherPending.push({ id: d.id, title: d.title, reason: s.reason });
}

console.log(JSON.stringify({ totalPublished: rows.length, counts }, null, 2));
console.log(`\nTITLE REPAIRS AWAITING PUSH (${titleRepairs.length}):`);
for (const t of titleRepairs) console.log(`#${t.id}\t${t.title}`);
console.log(`\nOTHER PENDING (${otherPending.length}), first 25:`);
for (const t of otherPending.slice(0, 25)) {
  console.log(`#${t.id}\t[${t.reason}]\t${t.title}`);
}

await client.end();
