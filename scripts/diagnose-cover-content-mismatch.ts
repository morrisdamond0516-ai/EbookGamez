/**
 * Two-sided diagnosis:
 * A) Drafts that have a cover but should NOT have content (orphan / placeholder)
 * B) Visible storefront books whose linked draft has no content in dev
 */
import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const liveUrl = 'https://EbookGamez.replit.app';

// A) Published drafts that have a cover_url but NO content (cover without content)
const coverNoContent = await db.execute(sql`
  SELECT d.id, d.title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len,
         d.cover_url IS NOT NULL AND d.cover_url != '' AS has_cover,
         b.id AS book_id, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.cover_url IS NOT NULL AND d.cover_url != ''
    AND (d.content IS NULL OR LENGTH(d.content) < 100)
  ORDER BY d.id
`) as any;

// B) Visible storefront books whose linked draft has no content
const pubNoContent = await db.execute(sql`
  SELECT b.id AS book_id, b.title, b.visible,
         d.id AS draft_id, d.title AS draft_title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len
  FROM books b
  JOIN draft_ebooks d ON d.id = b.source_draft_id
  WHERE b.visible = true
    AND (d.content IS NULL OR LENGTH(d.content) < 100)
  ORDER BY b.id
`) as any;

// C) All published drafts — show content vs cover status overview
const overview = await db.execute(sql`
  SELECT
    COUNT(*) FILTER (WHERE content IS NOT NULL AND LENGTH(content) > 100) AS has_content,
    COUNT(*) FILTER (WHERE content IS NULL OR LENGTH(content) < 100)      AS no_content,
    COUNT(*) FILTER (WHERE cover_url IS NOT NULL AND cover_url != '')      AS has_cover,
    COUNT(*) FILTER (WHERE cover_url IS NULL OR cover_url = '')            AS no_cover,
    COUNT(*) FILTER (WHERE cover_url IS NOT NULL AND cover_url != ''
                     AND (content IS NULL OR LENGTH(content) < 100))       AS cover_but_no_content,
    COUNT(*) FILTER (WHERE (cover_url IS NULL OR cover_url = '')
                     AND content IS NOT NULL AND LENGTH(content) > 100)    AS content_but_no_cover
  FROM draft_ebooks
  WHERE status = 'published'
`) as any;

console.log('═══ OVERVIEW of published drafts ═══');
const ov = overview.rows[0];
console.log(`  Has content:          ${ov.has_content}`);
console.log(`  No content:           ${ov.no_content}`);
console.log(`  Has cover:            ${ov.has_cover}`);
console.log(`  No cover:             ${ov.no_cover}`);
console.log(`  Cover but NO content: ${ov.cover_but_no_content}  ← Problem A`);
console.log(`  Content but NO cover: ${ov.content_but_no_cover}  ← might be fine`);

console.log(`\n═══ A) Drafts with a cover but NO content (${coverNoContent.rows.length}) ═══`);
for (const r of (coverNoContent.rows as any[])) {
  const linked = r.book_id ? `→ book #${r.book_id} [vis:${r.visible}]` : '→ orphan (no book)';
  console.log(`  Draft #${r.id} "${r.title}" [${r.status}] ${linked}`);
}

console.log(`\n═══ B) Storefront books whose draft has NO content (${pubNoContent.rows.length}) ═══`);
for (const r of (pubNoContent.rows as any[])) {
  const match = (r.title||'').toLowerCase().trim() === (r.draft_title||'').toLowerCase().trim();
  console.log(`  Book #${r.book_id} "${r.title}" → draft #${r.draft_id} "${r.draft_title}" [${r.status}] ${match ? '' : '⚠️ TITLE MISMATCH'}`);
}

process.exit(0);
