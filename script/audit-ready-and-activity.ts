import "./load-env.ts";
import pg from "pg";
import { draftHasPublishableCover } from "../server/coverStorage";
import { parseCoverDeferredFromDescription } from "@shared/coverMetadata";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const readyWithCover = await c.query(`
  SELECT id, title, status, genre, cover_url, background_url, published_at, description
  FROM draft_ebooks
  WHERE status = 'ready'
    AND (cover_url IS NOT NULL OR background_url IS NOT NULL)
  ORDER BY id DESC
  LIMIT 40
`);

console.log(`=== READY drafts with cover URLs (${readyWithCover.rows.length} shown) ===`);
for (const r of readyWithCover.rows) {
  const cat = await c.query(
    `SELECT id, visible, source_draft_id FROM books WHERE source_draft_id = $1 OR lower(title) = lower($2) LIMIT 1`,
    [r.id, r.title],
  );
  const book = cat.rows[0];
  const pubCover = draftHasPublishableCover({
    coverUrl: r.cover_url,
    backgroundUrl: r.background_url,
    description: r.description,
    publishedAt: r.published_at,
  });
  const deferred = parseCoverDeferredFromDescription(r.description);
  console.log(
    `#${r.id} ${r.title.slice(0, 42)} | catalog: ${book ? `#${book.id} vis=${book.visible} src=${book.source_draft_id}` : "NONE"} | publishableCover: ${pubCover} | deferred: ${!!deferred}`,
  );
}

const activity = await c.query(`
  SELECT id, title, status, genre, cover_url, background_url, description,
    (content LIKE '%[ILLUSTRATION:%') AS has_any_marker,
    (content ~ '\\[ILLUSTRATION:\\s*[^/\\]]') AS has_text_marker,
    (content LIKE '%/uploads/illustrations/%' OR content LIKE '%/objstore/illustrations/%') AS has_img
  FROM draft_ebooks
  WHERE genre ILIKE '%activity%'
  ORDER BY id DESC
  LIMIT 25
`);

console.log(`\n=== Recent Activity Books (${activity.rows.length}) ===`);
for (const r of activity.rows) {
  const pubCover = draftHasPublishableCover({
    coverUrl: r.cover_url,
    backgroundUrl: r.background_url,
    description: r.description,
  });
  console.log(
    `#${r.id} [${r.status}] ${r.title.slice(0, 40)}`,
  );
  console.log(
    `   markers: ${r.has_any_marker} text_pending: ${r.has_text_marker} images: ${r.has_img} cover_ok: ${pubCover}`,
  );
}

await c.end();
