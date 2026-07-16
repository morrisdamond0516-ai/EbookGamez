import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { sql } from "drizzle-orm";

const rows = await db.execute(sql`
  SELECT id, title, genre, cover_style_id, cover_url, background_url, overlay_approved
  FROM draft_ebooks
  WHERE title ILIKE '%Grade 1%Reading%' OR title ILIKE '%Grade 1 Reading%'
  ORDER BY id
`);
for (const r of rows.rows as any[]) {
  console.log(`#${r.id}`);
  console.log(`  title: ${r.title}`);
  console.log(`  genre: ${r.genre}`);
  console.log(`  style: ${r.cover_style_id}`);
  console.log(`  cover: ${r.cover_url}`);
  console.log(`  bg: ${r.background_url}`);
  console.log(`  overlayApproved: ${r.overlay_approved}`);
  console.log(`  title length: ${String(r.title).length} chars, ${String(r.title).split(/\s+/).length} words`);
}
