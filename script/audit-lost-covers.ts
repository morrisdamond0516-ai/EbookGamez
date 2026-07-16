/**
 * Find every draft that lost its cover image (DB URL exists but file is missing).
 * Run: npx tsx --import ./script/load-env.ts script/audit-lost-covers.ts
 */
import "./load-env.ts";
import pg from "pg";
import {
  coverFilenameFromUrl,
  coverFileExistsLocally,
  draftCoverLikelyReachable,
  draftCoverIsReachable,
  isLocalWorkspaceMode,
} from "../server/coverStorage";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log(`Mode: ${isLocalWorkspaceMode() ? "local/Cursor (disk is source of truth)" : "Replit/GCS"}\n`);

const rows = await client.query(`
  SELECT id, title, genre, status, cover_url, background_url, cover_style_id, overlay_approved, published_at
  FROM draft_ebooks
  ORDER BY id
`);

type Row = (typeof rows.rows)[0];

interface LostCover {
  id: number;
  title: string;
  genre: string;
  status: string;
  coverUrl: string | null;
  backgroundUrl: string | null;
  coverStyleId: string | null;
  publishedAt: Date | null;
  reason: string;
  filenames: string[];
}

const lost: LostCover[] = [];
const ok: Row[] = [];
const neverHadCover: Row[] = [];

for (const row of rows.rows) {
  const coverUrl = row.cover_url as string | null;
  const backgroundUrl = row.background_url as string | null;
  const hasUrl = !!(coverUrl || backgroundUrl);

  if (!hasUrl) {
    neverHadCover.push(row);
    continue;
  }

  const reachableSync = draftCoverLikelyReachable(coverUrl, backgroundUrl);
  const reachableAsync = await draftCoverIsReachable(coverUrl, backgroundUrl);

  if (reachableSync && reachableAsync) {
    ok.push(row);
    continue;
  }

  const filenames = [coverUrl, backgroundUrl]
    .filter(Boolean)
    .map((u) => coverFilenameFromUrl(u))
    .filter(Boolean) as string[];

  const localMissing = filenames.filter((f) => !coverFileExistsLocally(`/uploads/covers/${f}`));

  let reason = "URL in DB but file missing locally";
  if (!isLocalWorkspaceMode() && reachableAsync) {
    reason = "in GCS (OK on Replit)";
    ok.push(row);
    continue;
  }
  if (localMissing.length > 0) {
    reason = `missing local file(s): ${localMissing.join(", ")}`;
  }
  if ((coverUrl || "").startsWith("/objstore/") && isLocalWorkspaceMode()) {
    reason += " — fake objstore URL from local gen without GCS upload";
  }

  lost.push({
    id: row.id,
    title: row.title,
    genre: row.genre,
    status: row.status,
    coverUrl,
    backgroundUrl,
    coverStyleId: row.cover_style_id,
    publishedAt: row.published_at,
    reason,
    filenames,
  });
}

// Research batch #707–728
const researchBatch = lost.filter((d) => d.id >= 707 && d.id <= 728);

// Already quarantined in DB (no URLs) but had style — drafts that need regen and should show in UI
const quarantinedInDb = await client.query(`
  SELECT id, title, genre, status, cover_style_id, published_at, description
  FROM draft_ebooks
  WHERE cover_url IS NULL AND background_url IS NULL
    AND (description IS NOT NULL AND description != '')
  ORDER BY id
`);

// Drafts with no cover that have cover_style_id still set (UI grouping bug candidate)
const staleStyleNoCover = await client.query(`
  SELECT id, title, cover_style_id, cover_url, background_url
  FROM draft_ebooks
  WHERE (cover_url IS NULL OR cover_url = '')
    AND (background_url IS NULL OR background_url = '')
    AND cover_style_id IS NOT NULL AND cover_style_id != ''
  ORDER BY id
`);

console.log("=== SUMMARY ===");
console.log(`Total drafts: ${rows.rowCount}`);
console.log(`Covers OK (file or GCS): ${ok.length}`);
console.log(`Never had cover URL: ${neverHadCover.length}`);
console.log(`LOST / broken covers (URL in DB, file missing): ${lost.length}`);
console.log(`  Research batch #707–728 in lost list: ${researchBatch.length}`);
console.log(`Already no URL in DB (quarantined or never generated): ${quarantinedInDb.rowCount}`);
console.log(`No cover but cover_style_id still set (should be cleared): ${staleStyleNoCover.rowCount}`);

console.log("\n=== LOST COVERS (need regeneration) ===");
if (lost.length === 0) {
  console.log("(none with URLs pointing at missing files — check quarantined list below)");
} else {
  for (const d of lost) {
    const pub = d.publishedAt ? " [published]" : "";
    const style = d.coverStyleId ? ` style=${d.coverStyleId}` : "";
    console.log(`#${d.id} ${d.title}${pub}${style}`);
    console.log(`    ${d.reason}`);
    if (d.coverUrl) console.log(`    cover_url: ${d.coverUrl}`);
    if (d.backgroundUrl && d.backgroundUrl !== d.coverUrl) console.log(`    background_url: ${d.backgroundUrl}`);
  }
}

console.log("\n=== NO COVER IN DB — likely quarantined or title placers ===");
const placers = quarantinedInDb.rows.filter((r) => r.id >= 707 && r.id <= 728);
console.log(`Research batch #707–728 with no URL: ${placers.length}`);
for (const r of quarantinedInDb.rows) {
  if (r.id < 640) continue; // skip very old unless user cares — show recent
  const style = r.cover_style_id ? ` STALE style=${r.cover_style_id}` : "";
  console.log(`#${r.id} ${r.title} (${r.status})${style}`);
}

if (staleStyleNoCover.rowCount > 0) {
  console.log("\n=== STALE cover_style_id (no image — may be hidden from Awaiting section) ===");
  for (const r of staleStyleNoCover.rows) {
    console.log(`#${r.id} ${r.title} style=${r.cover_style_id}`);
  }
}

await client.end();
