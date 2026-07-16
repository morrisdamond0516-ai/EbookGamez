/**
 * Fix research-batch books that failed strict quality audit.
 *   npx tsx --import ./script/load-env.ts script/fix-strict-failures.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  generateContentForDraft,
  rewriteChapterBatch,
  runPublishPipelineGate,
  publishDraft,
  createPdfFromContent,
} from "../server/contentStudio";

const CHAPTER_DIALOGUE_FIXES: Record<number, number[]> = {
  708: [1, 2, 3, 4, 6, 10],
  710: [1, 2, 3, 4, 5, 6, 10],
};

async function demoteToDraft(id: number) {
  await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, id));
}

async function finalizeStrict(id: number): Promise<boolean> {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d) return false;
  const gate = await runPublishPipelineGate(d, { strict: true });
  if (!gate.pass) {
    console.log(`#${id} strict gate FAIL — not publishing:`);
    for (const iss of gate.issues.slice(0, 8)) console.log(`  - ${iss}`);
    return false;
  }
  await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, id));
  const pdfUrl = await createPdfFromContent(d.title || "", d.content || "");
  if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, id));
  await publishDraft(id);
  console.log(`#${id} strict gate PASS → published`);
  return true;
}

console.log("=== Fix strict-audit failures (#708, #710, then #707) ===\n");

for (const [idStr, chapters] of Object.entries(CHAPTER_DIALOGUE_FIXES)) {
  const id = Number(idStr);
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  console.log(`\n--- #${id} ${d?.title} — dialogue rewrite chapters ${chapters.join(", ")} ---\n`);
  await demoteToDraft(id);
  try {
    await rewriteChapterBatch(id, chapters);
    await finalizeStrict(id);
  } catch (e: any) {
    console.error(`#${id} rewrite error:`, e?.message || e);
  }
}

console.log("\n--- #707 The Ember Bond — full rewrite (wrong book content) ---\n");
await demoteToDraft(707);
await db.update(draftEbooks).set({ content: "" }).where(eq(draftEbooks.id, 707));
try {
  await generateContentForDraft(707);
  await finalizeStrict(707);
} catch (e: any) {
  console.error("#707 rewrite error:", e?.message || e);
}

console.log("\n=== Done ===");
