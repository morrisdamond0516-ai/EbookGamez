/**
 * Backfill ---PROD_SYNC--- stamps for published drafts that are already in the
 * local storefront catalog but never got a fingerprint (legacy publishes).
 * After this, future edits correctly show "Prod: changed" instead of a fake 600+ queue.
 *
 * Usage:
 *   node script/run-tsx.mjs script/backfill-prod-sync-stamps.ts --dry-run
 *   node script/run-tsx.mjs script/backfill-prod-sync-stamps.ts
 */
import "./load-env.ts";
import pg from "pg";
import {
  computeDraftProdFingerprint,
  parseProdSyncFromDescription,
  withProdSyncInDescription,
} from "../shared/prodSyncMetadata.ts";

const dryRun = process.argv.includes("--dry-run");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT d.id, d.title, d.content, d.cover_url AS "coverUrl",
         d.background_url AS "backgroundUrl", d.description, d.status,
         b.id AS book_id
  FROM draft_ebooks d
  INNER JOIN books b
    ON (
      b.source_draft_id = d.id
      OR LOWER(TRIM(b.title)) = LOWER(TRIM(d.title))
    )
  WHERE d.status = 'published'
    AND d.content IS NOT NULL
  ORDER BY d.id
`);

// Dedupe drafts that match multiple catalog rows
const seen = new Set<number>();
let stamped = 0;
let skippedHasStamp = 0;
let skippedNoMatch = 0;

for (const d of rows) {
  if (seen.has(d.id)) continue;
  seen.add(d.id);
  if (parseProdSyncFromDescription(d.description)) {
    skippedHasStamp++;
    continue;
  }
  const fingerprint = computeDraftProdFingerprint(d);
  const description = withProdSyncInDescription(d.description, {
    fingerprint,
    syncedAt: new Date().toISOString(),
    productionUrl: "backfill-catalog",
  });
  if (dryRun) {
    stamped++;
    if (stamped <= 15) console.log(`[dry-run] would stamp #${d.id} book=#${d.book_id} ${d.title}`);
    continue;
  }
  await client.query(`UPDATE draft_ebooks SET description = $1 WHERE id = $2`, [
    description,
    d.id,
  ]);
  stamped++;
  if (stamped % 50 === 0) console.log(`Stamped ${stamped}…`);
}

console.log(
  JSON.stringify(
    {
      dryRun,
      catalogLinkedRows: rows.length,
      uniqueDrafts: seen.size,
      stamped,
      skippedHasStamp,
      skippedNoMatch,
    },
    null,
    2,
  ),
);

await client.end();
