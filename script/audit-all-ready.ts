import "./load-env.ts";
import pg from "pg";
import { draftHasPublishableCover } from "../server/coverStorage";
import { runPublishPipelineGate } from "../server/contentStudio";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const ready = await c.query(
  `SELECT id, title, genre, status, cover_url, background_url, description, published_at
   FROM draft_ebooks WHERE status = 'ready' ORDER BY id`,
);
console.log(`=== ${ready.rows.length} READY drafts ===\n`);

const pass: number[] = [];
const fail: Array<{ id: number; title: string; issues: string[]; hasCatalog: boolean }> = [];

for (const r of ready.rows) {
  const book = await c.query(
    `SELECT id, visible, source_draft_id FROM books
     WHERE lower(trim(title)) = lower(trim($1)) OR source_draft_id = $2
     LIMIT 1`,
    [r.title, r.id],
  );
  const b = book.rows[0];
  const coverOk = draftHasPublishableCover({
    coverUrl: r.cover_url,
    backgroundUrl: r.background_url,
    description: r.description,
    publishedAt: r.published_at,
  });

  const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, r.id));
  const gate = await runPublishPipelineGate(draft, { verifyGenre: false, dialogueCheck: false });

  const tag = b ? `catalog #${b.id} vis=${b.visible}` : "no catalog";
  console.log(`#${r.id} [${r.genre?.slice(0, 22)}] cover=${coverOk} gate=${gate.pass ? "PASS" : "FAIL"} | ${tag}`);
  if (!gate.pass) {
    for (const issue of gate.issues.slice(0, 4)) console.log(`   - ${issue}`);
    if (gate.issues.length > 4) console.log(`   ... +${gate.issues.length - 4} more`);
    fail.push({ id: r.id, title: r.title, issues: gate.issues, hasCatalog: !!b });
  } else if (coverOk) {
    pass.push(r.id);
  } else {
    fail.push({ id: r.id, title: r.title, issues: ["Cover not publishable"], hasCatalog: !!b });
  }
}

console.log(`\n=== Summary ===`);
console.log(`Pass quality + cover: ${pass.length} → ${pass.join(", ") || "(none)"}`);
console.log(`Fail: ${fail.length}`);
for (const f of fail) {
  console.log(`  #${f.id} ${f.title.slice(0, 40)} ${f.hasCatalog ? "[had catalog]" : "[new]"}`);
}

await c.end();
