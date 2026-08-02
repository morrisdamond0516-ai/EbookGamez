import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Find every published draft where the title doesn't match the H1 in the content
const all = await db.execute(sql`
  SELECT id, title,
         SUBSTRING(content, 1, 300) AS head
  FROM draft_ebooks
  WHERE status = 'published'
    AND content IS NOT NULL
    AND LENGTH(content) > 100
  ORDER BY id
`) as any;

const toFix: { id: number; oldTitle: string; newTitle: string }[] = [];

for (const r of all.rows as any[]) {
  const h1 = (r.head as string)?.match(/^#\s+(.+)/m)?.[1]?.trim() ?? '';
  if (h1 && h1.toLowerCase() !== (r.title as string).trim().toLowerCase()) {
    toFix.push({ id: Number(r.id), oldTitle: r.title, newTitle: h1 });
  }
}

console.log(`Drafts with title/content mismatch: ${toFix.length}\n`);
for (const f of toFix) {
  console.log(`  Draft #${f.id}:`);
  console.log(`    Old title: "${f.oldTitle}"`);
  console.log(`    New title: "${f.newTitle}"`);
}

if (toFix.length === 0) {
  console.log('Nothing to fix.');
  process.exit(0);
}

// Apply renames
let fixed = 0;
for (const f of toFix) {
  await db.execute(sql`
    UPDATE draft_ebooks SET title = ${f.newTitle} WHERE id = ${f.id}
  `);
  fixed++;
}

console.log(`\n✅ Renamed ${fixed} drafts to match their content.`);

// Verify
const after = await db.execute(sql`
  SELECT id, title FROM draft_ebooks WHERE id = ANY(${toFix.map(f => f.id)}::int[]) ORDER BY id
`) as any;
console.log('\nAfter rename:');
for (const r of after.rows as any[]) {
  console.log(`  Draft #${r.id} → "${r.title}"`);
}

process.exit(0);
