/** Simulate ready-for-review API flags */
import "./load-env.ts";
import pg from "pg";
import { enrichDraftForCoverReview } from "../server/coverStorage";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const rows = await c.query(`
  SELECT id, title, cover_url, background_url, cover_style_id, published_at
  FROM draft_ebooks ORDER BY id
`);
let regen = 0;
const regenIds: number[] = [];
for (const d of rows.rows) {
  const e = enrichDraftForCoverReview({
    id: d.id,
    coverUrl: d.cover_url,
    backgroundUrl: d.background_url,
    coverStyleId: d.cover_style_id,
    publishedAt: d.published_at,
  });
  if (e.needsCoverRegeneration) {
    regen++;
    regenIds.push(d.id);
  }
}
console.log(`needsCoverRegeneration from enrichDraftForCoverReview: ${regen}`);
console.log(`IDs: ${regenIds.join(", ")}`);
await c.end();
