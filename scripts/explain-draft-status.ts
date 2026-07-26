import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Full breakdown of all draft-status books
const allDrafts = await db.execute(sql`
  SELECT d.id, d.title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len,
         d.cover_url IS NOT NULL AND d.cover_url != '' AS has_cover,
         b.id AS book_id, b.title AS book_title, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.status = 'draft'
  ORDER BY d.id
`) as any;

// Categorise them
const demotedThisSession = new Set([
  20,31,34,36,37,52,65,97,139,146,148,149,153,162,164,165,172,
  183,186,195,215,217,221,227,230,250,252,258,265,451,606,
  653,671,672,676,685,687,693,694
]);

const withBook: any[]    = [];  // draft status but still has a book linked — problem!
const demoted: any[]     = [];  // ones we demoted this session
const preExisting: any[] = [];  // were draft before our session

for (const r of (allDrafts.rows as any[])) {
  if (r.book_id) { withBook.push(r); continue; }
  if (demotedThisSession.has(r.id)) { demoted.push(r); continue; }
  preExisting.push(r);
}

console.log(`Total in 'draft' status: ${allDrafts.rows.length}\n`);

console.log(`══ A) Drafts we demoted this session (old placeholders): ${demoted.length} ══`);
console.log('   These are the old dev placeholder names replaced by the production renames.');
console.log('   (Cosmic Dread, Atomic Productivity, The Universe of Us, etc.)\n');

console.log(`══ B) Pre-existing draft-status books (were draft before our session): ${preExisting.length} ══`);
for (const r of preExisting) {
  const size = r.content_len > 1000 ? `${Math.round(r.content_len/1000)}K chars` : `${r.content_len} chars`;
  const cover = r.has_cover ? '🖼' : '  ';
  console.log(`   ${cover} Draft #${r.id} "${(r.title||'').slice(0,55)}" [${size}]`);
}

console.log(`\n══ C) Draft-status but still linked to a book — PROBLEM: ${withBook.length} ══`);
for (const r of withBook) {
  console.log(`   ❌ Draft #${r.id} "${r.title}" → Book #${r.book_id} "${r.book_title}"`);
}

// Summary counts
const withContent = preExisting.filter(r => r.content_len > 10000);
const empty       = preExisting.filter(r => r.content_len < 100);
console.log(`\nOf the ${preExisting.length} pre-existing drafts:`);
console.log(`  With substantial content: ${withContent.length}`);
console.log(`  Essentially empty:        ${empty.length}`);
process.exit(0);
