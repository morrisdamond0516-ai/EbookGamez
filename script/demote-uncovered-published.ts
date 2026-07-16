/**
 * Demote published drafts without a reachable cover (uses strict file/GCS check).
 * Run: npx tsx --import ./script/load-env.ts script/demote-uncovered-published.ts [id ...]
 */
import "./load-env.ts";
import { demotePublishedWithoutReachableCover } from "../server/contentStudio";

const ids = process.argv.slice(2).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));

if (ids.length > 0) {
  const pg = await import("pg");
  const { draftHasPublishableCover, draftCoverIsReachable } = await import("../server/coverStorage");
  const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const draftId of ids) {
    const r = await client.query(
      `SELECT id, title, cover_url, background_url FROM draft_ebooks WHERE id = $1`,
      [draftId],
    );
    const row = r.rows[0];
    if (!row) { console.log(`#${draftId} not found`); continue; }
    let ok = draftHasPublishableCover(row);
    if (ok && (row.cover_url || row.background_url)) {
      ok = await draftCoverIsReachable(row.cover_url, row.background_url);
    }
    if (ok) {
      console.log(`#${draftId} "${row.title}" has reachable cover — skip`);
      continue;
    }
    await client.query(
      `UPDATE draft_ebooks SET status = 'ready', published_at = NULL, cover_url = NULL, background_url = NULL, overlay_approved = false WHERE id = $1`,
      [draftId],
    );
    const books = await client.query(
      `UPDATE books SET visible = false WHERE source_draft_id = $1 RETURNING id, title`,
      [draftId],
    );
    console.log(`#${draftId} "${row.title}" → demoted; hid ${books.rowCount} catalog row(s)`);
  }
  await client.end();
} else {
  const n = await demotePublishedWithoutReachableCover();
  console.log(`Demoted ${n} published draft(s) without reachable covers.`);
}
