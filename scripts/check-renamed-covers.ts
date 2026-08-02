import { db } from '../server/storage';
import { sql } from 'drizzle-orm';

const r = await db.execute(sql`
  SELECT id, title, cover_url
  FROM draft_ebooks
  WHERE id = ANY(ARRAY[739,740,741,742,744,774,775,776,777,778,779,780,781,782,783,784]::int[])
  ORDER BY id
`) as any;

for (const row of r.rows as any[]) {
  const hasCover = row.cover_url && (row.cover_url as string).trim().length > 0;
  console.log(`Draft #${row.id} "${row.title}"`);
  console.log(`  Cover: ${hasCover ? row.cover_url : '❌ MISSING'}`);
}

process.exit(0);
