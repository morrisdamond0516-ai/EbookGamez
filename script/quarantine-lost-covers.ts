/**
 * Quarantine all drafts with missing cover files and clear stale cover_style_id
 * when no cover image exists — so Cover Review shows them in needs-cover queue.
 *
 * Run: npm run quarantine:lost-covers
 */
import "./load-env.ts";
import pg from "pg";
import { draftCoverIsReachable } from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const withUrls = await client.query(`
  SELECT id, title, cover_url, background_url
  FROM draft_ebooks
  WHERE cover_url IS NOT NULL OR background_url IS NOT NULL
  ORDER BY id
`);

let quarantined = 0;
const quarantinedIds: number[] = [];

for (const row of withUrls.rows) {
  const reachable = await draftCoverIsReachable(row.cover_url, row.background_url);
  if (!reachable) {
    await client.query(
      `UPDATE draft_ebooks
       SET cover_url = NULL, background_url = NULL, overlay_approved = false
       WHERE id = $1`,
      [row.id],
    );
    quarantined++;
    quarantinedIds.push(row.id);
    console.log(`  quarantined #${row.id} ${row.title}`);
  }
}

console.log(`\nQuarantined ${quarantined} draft(s) with missing cover files: [${quarantinedIds.join(", ")}]`);
console.log(`(cover_style_id preserved — run npm run restore:cover-styles if styles were cleared earlier)`);

await client.end();
