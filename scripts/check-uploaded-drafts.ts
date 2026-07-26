import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const rows = await db.execute(sql`
  SELECT d.id, d.title, d.status,
         COALESCE(LENGTH(d.content),0) AS content_len,
         b.id AS book_id, b.title AS book_title, b.visible
  FROM draft_ebooks d
  LEFT JOIN books b ON b.source_draft_id = d.id
  WHERE d.id IN (739,740,741,742,744,774,775,776,777,778,779,780,781,782,783,784)
  ORDER BY d.id
`) as any;

const liveRes = await fetch('https://EbookGamez.replit.app/api/books?limit=2000');
const liveData = await liveRes.json() as any;
const liveBooks: any[] = Array.isArray(liveData) ? liveData : (liveData.books ?? []);
const liveTitles = new Set(liveBooks.map(b => (b.title||'').toLowerCase().trim()));

console.log('Draft | Content | Dev catalog | Production\n' + '─'.repeat(90));
for (const r of (rows.rows as any[])) {
  const inProd = liveTitles.has((r.title||'').toLowerCase().trim());
  const inDev  = r.book_id ? `book #${r.book_id} [vis:${r.visible}]` : 'NOT in catalog';
  console.log(`#${r.id} "${(r.title||'').padEnd(45).slice(0,45)}" | ${String(r.content_len).padStart(7)} chars | ${inDev.padEnd(22)} | ${inProd ? '✅ live' : '❌ not live'}`);
}
process.exit(0);
