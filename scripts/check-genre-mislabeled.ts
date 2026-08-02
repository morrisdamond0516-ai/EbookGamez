import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

// Check genre on the recently renamed drafts and find any showing "textbook"
const r = await db.execute(sql`
  SELECT id, title, genre, topic
  FROM draft_ebooks
  WHERE id = ANY(ARRAY[739,740,741,742,744,774,775,776,777,778,779,780,781,782,783,784]::int[])
  ORDER BY id
`) as any;

console.log('Recently renamed drafts — genre/topic:\n');
for (const row of r.rows as any[]) {
  console.log(`  Draft #${row.id} "${row.title}"`);
  console.log(`    genre: ${row.genre ?? '(null)'}  topic: ${row.topic ?? '(null)'}`);
}

// Also find all published drafts with genre = textbook or similar
const textbooks = await db.execute(sql`
  SELECT id, title, genre, topic
  FROM draft_ebooks
  WHERE status = 'published'
    AND (genre ILIKE '%textbook%' OR genre ILIKE '%curriculum%' OR genre ILIKE '%education%')
  ORDER BY id
  LIMIT 30
`) as any;

console.log(`\nAll published drafts with textbook-like genre (${textbooks.rows.length}):\n`);
for (const row of textbooks.rows as any[]) {
  console.log(`  Draft #${row.id} "${row.title}" — genre: ${row.genre}`);
}

process.exit(0);
