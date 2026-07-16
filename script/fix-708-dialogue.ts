/**
 * Rewrite dialogue-flagged chapters on #708 with retries, then strict gate + publish.
 *   npx tsx --import ./script/load-env.ts script/fix-708-dialogue.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  rewriteSection,
  runPublishPipelineGate,
  publishDraft,
  createPdfFromContent,
} from "../server/contentStudio";

const id = 708;
const chapters = [1, 2, 3, 4, 5, 6, 10, 12];
const MAX_ATTEMPTS = 4;

await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, id));
console.log(`Rewriting dialogue chapters ${chapters.join(", ")} for #${id} (with retries)...`);

for (const ch of chapters) {
  let ok = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Chapter ${ch} attempt ${attempt}/${MAX_ATTEMPTS}...`);
      const result = await rewriteSection(id, ch);
      console.log(`Chapter ${ch} done — ${result.wordCount} words`);
      ok = true;
      break;
    } catch (e: any) {
      console.error(`Chapter ${ch} attempt ${attempt} failed: ${e?.message || e}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  if (!ok) {
    console.error(`Chapter ${ch} failed after ${MAX_ATTEMPTS} attempts — aborting`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 3000));
}

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
const gate = await runPublishPipelineGate(d!, { strict: true });
if (!gate.pass) {
  console.log(`#${id} strict FAIL:`);
  for (const iss of gate.issues.slice(0, 12)) console.log(`  - ${iss}`);
  process.exit(1);
}

await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, id));
const pdfUrl = await createPdfFromContent(d!.title || "", d!.content || "");
if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, id));
await publishDraft(id);
console.log(`#${id} strict PASS → published`);
