import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Pull several sections from each to compare
const drafts = await db.execute(sql`
  SELECT id, title,
         LENGTH(content) AS len,
         SUBSTRING(content, 1, 800) AS head,
         SUBSTRING(content, 5000, 600) AS mid1,
         SUBSTRING(content, 10000, 600) AS mid2
  FROM draft_ebooks
  WHERE id IN (741, 836, 778)
  ORDER BY id
`) as any;

for (const r of drafts.rows as any[]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Draft #${r.id} — "${r.title}" [${Number(r.len).toLocaleString()} chars]`);
  console.log(`\n--- HEAD ---\n${r.head}`);
  console.log(`\n--- MID @5000 ---\n${r.mid1}`);
  console.log(`\n--- MID @10000 ---\n${r.mid2}`);
}

// Count how many lines from 741 appear in 836
const d741 = await db.execute(sql`SELECT content FROM draft_ebooks WHERE id = 741`) as any;
const d836 = await db.execute(sql`SELECT content FROM draft_ebooks WHERE id = 836`) as any;

const lines741 = (d741.rows[0] as any).content.split('\n').filter((l: string) => l.trim().length > 50);
const content836: string = (d836.rows[0] as any).content;

let matches = 0;
const sample: string[] = [];
for (const line of lines741.slice(0, 200)) {
  if (content836.includes(line.trim())) {
    matches++;
    if (sample.length < 5) sample.push(line.trim().substring(0, 80));
  }
}

const pct = ((matches / Math.min(lines741.length, 200)) * 100).toFixed(1);
console.log(`\n\n=== OVERLAP CHECK ===`);
console.log(`Lines from #741 found in #836: ${matches} / ${Math.min(lines741.length, 200)} (${pct}%)`);
if (sample.length > 0) {
  console.log(`Sample matching lines:`);
  for (const s of sample) console.log(`  "${s}"`);
}
console.log(`\nVERDICT: ${Number(pct) > 50 ? '⚠️  DUPLICATE — same content' : Number(pct) > 10 ? '⚠️  PARTIAL OVERLAP — possibly same book' : '✅ DIFFERENT BOOKS — phrase match was coincidental'}`);

process.exit(0);
