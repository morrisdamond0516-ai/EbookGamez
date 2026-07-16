/** Finish fix: strict gate + publish for a draft ID. */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  runPublishPipelineGate,
  publishDraft,
  createPdfFromContent,
  generateContentForDraft,
} from "../server/contentStudio";

const id = parseInt(process.argv[2] || "707", 10);
const fullRewrite = process.argv.includes("--full-rewrite");

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
if (!d) {
  console.log(`#${id} not found`);
  process.exit(1);
}

if (fullRewrite) {
  console.log(`#${id} full rewrite from cover + outline...`);
  await db.update(draftEbooks).set({ status: "draft", content: "" }).where(eq(draftEbooks.id, id));
  await generateContentForDraft(id);
}

const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
const gate = await runPublishPipelineGate(fresh!, { strict: true });
if (!gate.pass) {
  console.log(`#${id} strict FAIL:`);
  for (const iss of gate.issues) console.log(`  - ${iss}`);
  process.exit(1);
}
await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, id));
const pdfUrl = await createPdfFromContent(fresh!.title || "", fresh!.content || "");
if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, id));
await publishDraft(id);
console.log(`#${id} strict PASS → published`);
