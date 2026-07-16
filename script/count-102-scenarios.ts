import "./load-env.ts";
import pg from "pg";
import { draftCoverLikelyReachable, LOST_COVER_REGEN_IDS } from "../server/coverStorage";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const rows = await c.query(`SELECT id, cover_url, background_url, cover_style_id, published_at, genre FROM draft_ebooks`);

const classicGenres = new Set([
  "Classic Literature", "Classic Adventure", "Classic Drama", "Classic Epic",
  "Classic Fantasy", "Classic Horror", "Classic Mystery", "Classic Philosophy",
  "Classic Romance", "Classic Science Fiction",
]);

function strictReach(d: typeof rows.rows[0]) {
  return draftCoverLikelyReachable(d.cover_url, d.background_url);
}
function withPubReach(d: typeof rows.rows[0]) {
  return draftCoverLikelyReachable(d.cover_url, d.background_url, { publishedAt: d.published_at });
}

// Hypothesis: old UI flagged !coverReachable && coverStyleId as needs regen
let h1 = 0;
// Hypothesis: !coverReachable for any draft with URL in DB (strict)
let h2 = 0;
// Hypothesis: ungrouped = no style OR no image; awaiting = placer OR needsRegen where needsRegen = !reachable && style
let h3 = 0;
let narrowRegen = 0;
let awaitingCurrent = 0;

for (const d of rows.rows) {
  const strict = strictReach(d);
  const withPub = withPubReach(d);
  const hasImgStrict = strict && !!(d.cover_url || d.background_url);
  const hasImgPub = withPub && !!(d.cover_url || d.background_url);

  if (d.cover_style_id && !strict) h1++;
  if ((d.cover_url || d.background_url) && !strict) h2++;
  if (d.cover_style_id && !withPub) h3++;

  const needsRegen = LOST_COVER_REGEN_IDS.has(d.id) && !withPub;
  if (needsRegen) narrowRegen++;

  const isPlacer = !d.cover_style_id && !hasImgPub;
  if ((needsRegen || isPlacer) && !classicGenres.has(d.genre)) awaitingCurrent++;
}

console.log("H1 style but strict unreachable:", h1);
console.log("H2 has URL but strict unreachable:", h2);
console.log("H3 has style but pub-trust unreachable:", h3);
console.log("Current narrow regen:", narrowRegen);
console.log("Current awaiting (no classics):", awaitingCurrent);

// Count ungrouped with isAwaitingCoverDraft using WRONG regen = !withPub && !!cover_style_id
let wrongAwaiting = 0;
let wrongRegen = 0;
for (const d of rows.rows) {
  const withPub = withPubReach(d);
  const hasImg = withPub && !!(d.cover_url || d.background_url);
  const wrongNeedsRegen = !withPub && !!d.cover_style_id;
  if (wrongNeedsRegen) wrongRegen++;
  if (wrongNeedsRegen || (!d.cover_style_id && !hasImg)) {
    if (!classicGenres.has(d.genre)) wrongAwaiting++;
  }
}
console.log("WRONG regen (!reachable && has style):", wrongRegen);
console.log("WRONG awaiting count (no classics):", wrongAwaiting);

await c.end();
