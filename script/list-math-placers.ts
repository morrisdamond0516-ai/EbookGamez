import "./load-env.ts";
import { db } from "../server/storage";
import { sql } from "drizzle-orm";

const rows = await db.execute(sql`
  SELECT id, title, genre, status,
         (cover_url IS NOT NULL OR background_url IS NOT NULL) AS has_cover
  FROM draft_ebooks
  WHERE title ILIKE '%algebra%' OR title ILIKE '%calculus%' OR title ILIKE '%trigonometry%'
     OR title ILIKE '%geometry%' OR title ILIKE '%precalculus%' OR title ILIKE '%pre-calc%'
  ORDER BY id
`);
for (const r of rows.rows as any[]) {
  console.log(`#${r.id} | ${r.title} | ${r.genre} | ${r.status} | cover=${r.has_cover}`);
}
console.log("count:", rows.rows.length);
