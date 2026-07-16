/**
 * After #741 Ch14 illus finish: text-repair again if needed, gate, publish.
 *   npx tsx script/finish-740-741.ts
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
  console.log(`[finish] ${m}`);
}

async function wait741(maxMs = 2 * 60 * 60 * 1000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 741));
    const left = countUnprocessedIllustrationMarkers(d?.content || "");
    if (left === 0) {
      log("#741 pending clear");
      return;
    }
    log(`waiting #741: ${left} pending...`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error("timeout waiting 741");
}

await wait741();
await new Promise((r) => setTimeout(r, 5000));

for (const id of [741]) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d?.content) continue;
  let content = d.content;
  let pending = countUnprocessedIllustrationMarkers(content);
  if (pending > 0) {
    log(`#${id} generating ${pending}...`);
    content = await generateIllustrations(content, d.genre || "Textbooks", d.title || "", id);
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, id));
  }
  const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  const gate = await runPublishPipelineGate(fresh!, { strict: true });
  log(`#${id} gate=${gate.pass ? "PASS" : "FAIL"}`);
  for (const iss of gate.issues.slice(0, 8)) log(`  - ${iss}`);
  if (!gate.pass) continue;
  if (fresh!.status === "published") {
    log(`#${id} already published`);
    continue;
  }
  const pdfUrl = await createPdfFromContent(fresh!.title || "", fresh!.content || "");
  await db
    .update(draftEbooks)
    .set({ status: "ready", ...(pdfUrl ? { pdfUrl } : {}) })
    .where(eq(draftEbooks.id, id));
  const bookId = await publishDraft(id);
  log(`#${id} published → book #${bookId}`);
}

process.exit(0);
