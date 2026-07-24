/**
 * Re-stamp published catalog drafts whose PROD_SYNC fingerprint drifted only
 * because the hash formula changed (title was added). Marks them Done again.
 *
 * Usage: node script/run-tsx.mjs script/restamp-prod-sync-fingerprint.ts
 */
import "./load-env.ts";
import pg from "pg";
import {
  assessProdSyncStatus,
  computeDraftProdFingerprint,
  withProdSyncInDescription,
} from "../shared/prodSyncMetadata.ts";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT d.id, d.title, d.status, d.content, d.cover_url AS "coverUrl",
         d.background_url AS "backgroundUrl", d.description,
         EXISTS (
           SELECT 1 FROM books b
           WHERE b.source_draft_id = d.id
              OR LOWER(TRIM(b.title)) = LOWER(TRIM(d.title))
         ) AS "inCatalog"
  FROM draft_ebooks d
  WHERE d.status = 'published' AND d.content IS NOT NULL
`);

let restamped = 0;
for (const d of rows) {
  if (!d.inCatalog) continue;
  const status = assessProdSyncStatus(d, { inCatalog: true });
  if (status.reason !== "local_changes") continue;
  const fingerprint = computeDraftProdFingerprint(d);
  const description = withProdSyncInDescription(d.description, {
    fingerprint,
    syncedAt: new Date().toISOString(),
    productionUrl: "restamp-fingerprint-v2",
  });
  await client.query(`UPDATE draft_ebooks SET description = $1 WHERE id = $2`, [
    description,
    d.id,
  ]);
  restamped++;
}

console.log(JSON.stringify({ restamped }, null, 2));
await client.end();
