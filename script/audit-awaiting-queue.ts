/**
 * Show exactly which drafts appear in Awaiting AI Style & Cover and why.
 * Run: npx tsx --import ./script/load-env.ts script/audit-awaiting-queue.ts
 */
import "./load-env.ts";
import pg from "pg";
import { draftNeedsCoverRegeneration, draftCoverLikelyReachable } from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const rows = await client.query(`
  SELECT id, title, genre, status, cover_url, background_url, cover_style_id, published_at
  FROM draft_ebooks
  ORDER BY id
`);

type Row = (typeof rows.rows)[0];

function isAwaiting(d: Row): { yes: boolean; reason: string } {
  const draft = {
    id: d.id,
    coverUrl: d.cover_url,
    backgroundUrl: d.background_url,
    coverStyleId: d.cover_style_id,
    publishedAt: d.published_at,
  };
  const reachable = draftCoverLikelyReachable(d.cover_url, d.background_url);
  const needsRegen = draftNeedsCoverRegeneration(draft);
  const hasImage = reachable && !!(d.cover_url || d.background_url);
  const isPlacer = !d.cover_style_id && !hasImage;

  if (needsRegen) {
    let why = "needsCoverRegeneration";
    if (d.cover_url || d.background_url) why += " (URLs but file missing)";
    else if (!d.published_at) why += " (unpublished + style, no image)";
    else if (d.id >= 646) why += " (id>=646 + style, no image)";
    return { yes: true, reason: why };
  }
  if (isPlacer) return { yes: true, reason: "title placer (no style, no cover)" };
  return { yes: false, reason: "has working cover or old catalog-only published" };
}

const awaiting: Array<{ id: number; title: string; reason: string; style: string | null; pub: boolean }> = [];
const notAwaiting = { hasCover: 0, oldPublished: 0, other: 0 };

for (const row of rows.rows) {
  const { yes, reason } = isAwaiting(row);
  if (yes) {
    awaiting.push({
      id: row.id,
      title: row.title,
      reason,
      style: row.cover_style_id,
      pub: !!row.published_at,
    });
  } else if (draftCoverLikelyReachable(row.cover_url, row.background_url)) {
    notAwaiting.hasCover++;
  } else if (row.published_at && row.id < 646) {
    notAwaiting.oldPublished++;
  } else {
    notAwaiting.other++;
  }
}

const byReason = new Map<string, number>();
for (const a of awaiting) {
  const key = a.reason.split(" (")[0];
  byReason.set(key, (byReason.get(key) ?? 0) + 1);
}

console.log("=== AWAITING AI STYLE & COVER QUEUE ===\n");
console.log(`Total in awaiting queue: ${awaiting.length}`);
console.log("By reason:");
for (const [k, v] of byReason) console.log(`  ${k}: ${v}`);
console.log(`\nNOT in queue: ${notAwaiting.hasCover} with working cover, ${notAwaiting.oldPublished} old published (id<646, hidden on purpose), ${notAwaiting.other} other`);

const lostBatch = awaiting.filter((a) => a.id >= 646 && a.id <= 728);
console.log(`\nYour lost cover batch (#646-648, #707-728): ${lostBatch.length} in queue`);
for (const a of lostBatch) {
  console.log(`  #${a.id} ${a.title} [${a.style}]`);
}

const unexpected = awaiting.filter((a) => a.id < 646 || a.id > 728);
console.log(`\nOTHER books in awaiting queue (not your lost batch): ${unexpected.length}`);
if (unexpected.length > 0 && unexpected.length <= 40) {
  for (const a of unexpected) {
    console.log(`  #${a.id} ${a.title.slice(0, 50)} — ${a.reason}`);
  }
} else if (unexpected.length > 40) {
  for (const a of unexpected.slice(0, 30)) {
    console.log(`  #${a.id} ${a.title.slice(0, 50)} — ${a.reason}`);
  }
  console.log(`  ... and ${unexpected.length - 30} more`);
}

await client.end();
