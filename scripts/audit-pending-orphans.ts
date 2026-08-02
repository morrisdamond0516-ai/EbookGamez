import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Get all 16 pending published orphans
const orphans = await db.execute(sql`
  SELECT d.id, d.title, d.cover_url,
         LENGTH(d.content) AS len,
         SUBSTRING(d.content, 1, 150) AS content_preview
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE b.id IS NULL AND d.status = 'published'
  ORDER BY d.id
`) as any;

console.log(`Pending orphan drafts: ${orphans.rows.length}\n`);

for (const r of orphans.rows as any[]) {
  // Check if any other draft or book shares this cover URL
  const coverMatch = await db.execute(sql`
    SELECT 'book' AS kind, id, title FROM books WHERE cover_url = ${r.cover_url}
    UNION ALL
    SELECT 'draft' AS kind, id, title FROM draft_ebooks WHERE cover_url = ${r.cover_url} AND id != ${r.id}
    LIMIT 5
  `) as any;

  // Extract the actual title from the content (first H1)
  const contentTitle = (r.content_preview as string)?.match(/^#\s+(.+)/m)?.[1] ?? '';
  const titleMatch = contentTitle.toLowerCase().trim() === (r.title as string).toLowerCase().trim();

  const status = titleMatch ? '✅ OK' : `⚠️  MISMATCH — content says "${contentTitle}"`;
  console.log(`Draft #${r.id} "${r.title}" — ${status}`);

  if (!titleMatch && coverMatch.rows.length > 0) {
    for (const m of coverMatch.rows as any[]) {
      console.log(`   Cover belongs to: ${m.kind} #${m.id} "${m.title}"`);
    }
  }
}

process.exit(0);
