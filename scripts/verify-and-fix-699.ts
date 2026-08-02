import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Fix #699 — restore its full title (was truncated in 300-char preview)
const d699 = await db.execute(sql`
  SELECT id, title, SUBSTRING(content, 1, 500) AS head FROM draft_ebooks WHERE id = 699
`) as any;
const row699 = d699.rows[0] as any;
console.log(`Draft #699 current title: "${row699.title}"`);
console.log(`Content head: ${row699.head?.substring(0, 200)}`);

// The real H1 from a longer preview
const fullHead = await db.execute(sql`
  SELECT SUBSTRING(content, 1, 2000) AS head FROM draft_ebooks WHERE id = 699
`) as any;
const realH1 = (fullHead.rows[0] as any).head?.match(/^#\s+(.+)/m)?.[1]?.trim() ?? '';
console.log(`Real H1: "${realH1}"`);

if (row699.title !== realH1) {
  await db.execute(sql`
    UPDATE draft_ebooks SET title = ${realH1} WHERE id = 699
  `);
  console.log(`✅ Fixed #699 → "${realH1}"`);
}

// Verify all 16 renames
const fixed = [739, 740, 741, 742, 744, 774, 775, 776, 777, 778, 779, 780, 781, 782, 783, 784];
const verify = await db.execute(sql`
  SELECT id, title FROM draft_ebooks
  WHERE id = ANY(ARRAY[739,740,741,742,744,774,775,776,777,778,779,780,781,782,783,784]::int[])
  ORDER BY id
`) as any;

console.log(`\nAll renamed drafts:`);
for (const r of verify.rows as any[]) {
  console.log(`  Draft #${r.id} → "${r.title}"`);
}

process.exit(0);
