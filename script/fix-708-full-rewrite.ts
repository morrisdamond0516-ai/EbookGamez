/**
 * Full rewrite of #708 The Neighbor's Lie from cover + outline, then strict publish.
 * Retries stub chapter repair if connection errors leave placeholders.
 *   npx tsx --import ./script/load-env.ts script/fix-708-full-rewrite.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  generateContentForDraft,
  repairIncompleteChapters,
  runPublishPipelineGate,
  publishDraft,
  createPdfFromContent,
} from "../server/contentStudio";

const id = 708;

console.log(`=== #${id} FULL REWRITE from cover + outline ===\n`);
await db.update(draftEbooks).set({ status: "draft", content: "" }).where(eq(draftEbooks.id, id));

try {
  await generateContentForDraft(id);
} catch (e: any) {
  console.error(`Full rewrite error: ${e?.message || e}`);
}

let [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
const words = (d?.content || "").split(/\s+/).length;
const stubs = (d?.content || "").match(/\[Content generation (incomplete|failed)[^\]]*\]/gi) || [];
console.log(`After gen: ${words} words, ${stubs.length} stub marker(s), status=${d?.status}`);

if (stubs.length > 0 || (d && d.status !== "ready" && d.status !== "published")) {
  console.log("\n=== Repairing incomplete chapters ===\n");
  try {
    await repairIncompleteChapters(id);
  } catch (e: any) {
    console.error(`Repair error: ${e?.message || e}`);
  }
}

[d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
const gate = await runPublishPipelineGate(d!, { strict: true });
if (!gate.pass) {
  console.log(`#${id} strict FAIL after full rewrite:`);
  for (const iss of gate.issues.slice(0, 12)) console.log(`  - ${iss}`);
  process.exit(1);
}

await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, id));
const pdfUrl = await createPdfFromContent(d!.title || "", d!.content || "");
if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, id));
await publishDraft(id);
console.log(`#${id} strict PASS → published (full rewrite)`);
