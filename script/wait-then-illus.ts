/**
 * Wait until draft #741 has no pending illustration markers (other process finishing),
 * then generate pending images for the listed IDs, gate, promote, optionally publish.
 *
 *   npx tsx script/wait-then-illus.ts 736 737 739 740 --publish --wait-for=741
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  generateIllustrations,
  runPublishPipelineGate,
  createPdfFromContent,
  publishDraft,
} from "../server/contentStudio";
import { countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

const ids = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => parseInt(a, 10))
  .filter((n) => !Number.isNaN(n));
const doPublish = process.argv.includes("--publish");
const waitForId = parseInt(
  process.argv.find((a) => a.startsWith("--wait-for="))?.split("=")[1] || "741",
  10,
);

function log(m: string) {
  console.log(`[wait-illus] ${m}`);
}

async function waitForDraftPendingClear(draftId: number, maxMs = 4 * 60 * 60 * 1000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
    const left = countUnprocessedIllustrationMarkers(d?.content || "");
    if (left === 0) {
      log(`#${draftId} pending illustrations clear`);
      return;
    }
    log(`waiting on #${draftId}: ${left} pending illustration(s)...`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new Error(`Timed out waiting for #${draftId} illustrations`);
}

async function gatePromotePublish(id: number) {
  const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!fresh?.content) {
    log(`#${id} no content for gate`);
    return;
  }
  const gate = await runPublishPipelineGate(fresh, { strict: true });
  log(`#${id} gate=${gate.pass ? "PASS" : "FAIL"}`);
  for (const iss of gate.issues.slice(0, 10)) log(`  - ${iss}`);
  if (!gate.pass) return;
  if (fresh.status === "published") {
    log(`#${id} already published`);
    return;
  }
  const pdfUrl = await createPdfFromContent(fresh.title || "", fresh.content || "");
  await db
    .update(draftEbooks)
    .set({ status: "ready", ...(pdfUrl ? { pdfUrl } : {}) })
    .where(eq(draftEbooks.id, id));
  log(`#${id} → ready`);
  if (doPublish) {
    try {
      const bookId = await publishDraft(id);
      log(`#${id} published → book #${bookId}`);
    } catch (e: any) {
      log(`#${id} publish error: ${e?.message || e}`);
    }
  }
}

if (waitForId && !Number.isNaN(waitForId)) {
  await waitForDraftPendingClear(waitForId);
  await new Promise((r) => setTimeout(r, 10_000));
  if (!ids.includes(waitForId)) {
    await gatePromotePublish(waitForId);
  }
}

for (const id of ids) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d?.content) {
    log(`#${id} no content`);
    continue;
  }
  let pending = countUnprocessedIllustrationMarkers(d.content);
  if (pending === 0) {
    log(`#${id} no pending markers`);
  } else {
    log(`#${id} generating ${pending} illustration(s)...`);
    const content = await generateIllustrations(d.content, d.genre || "Textbooks", d.title || "", id);
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, id));
    pending = countUnprocessedIllustrationMarkers(content);
    log(`#${id} done — remaining pending=${pending}`);
  }

  await gatePromotePublish(id);
}

process.exit(0);
