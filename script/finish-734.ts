/**
 * After #734 pending illus clear: gate + publish.
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  runPublishPipelineGate,
  createPdfFromContent,
  publishDraft,
  generateIllustrations,
} from "../server/contentStudio";
import { countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

function log(m: string) {
  console.log(`[finish-734] ${m}`);
}

const deadline = Date.now() + 3 * 60 * 60 * 1000;
while (Date.now() < deadline) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 734));
  const left = countUnprocessedIllustrationMarkers(d?.content || "");
  if (left === 0) {
    log("pending clear");
    break;
  }
  log(`waiting pending=${left}`);
  await new Promise((r) => setTimeout(r, 25_000));
}

await new Promise((r) => setTimeout(r, 5000));
let [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 734));
let pending = countUnprocessedIllustrationMarkers(d?.content || "");
if (pending > 0) {
  log(`generating remaining ${pending}`);
  const content = await generateIllustrations(d!.content!, d!.genre || "Textbooks", d!.title || "", 734);
  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 734));
}

[d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 734));
const gate = await runPublishPipelineGate(d!, { strict: true });
log(`gate=${gate.pass ? "PASS" : "FAIL"}`);
for (const i of gate.issues.slice(0, 10)) log(`  - ${i}`);
if (!gate.pass) process.exit(1);
if (d!.status === "published") {
  log("already published");
  process.exit(0);
}
const pdfUrl = await createPdfFromContent(d!.title || "", d!.content || "");
await db
  .update(draftEbooks)
  .set({ status: "ready", ...(pdfUrl ? { pdfUrl } : {}) })
  .where(eq(draftEbooks.id, 734));
const bookId = await publishDraft(734);
log(`published → book #${bookId}`);
process.exit(0);
