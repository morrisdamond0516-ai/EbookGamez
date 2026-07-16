/**
 * Bedtime follow-through for schoolbook student-voice regenerations.
 *
 * Waits for target drafts to finish generating, then for each:
 *   fill pending illustrations → strict quality gate → promote → publish
 * (reuses hidden catalog rows via publishDraft / sourceDraftId).
 *
 *   npx tsx --import ./script/load-env.ts script/finish-schoolbook-student-rewrites.ts
 *   npx tsx --import ./script/load-env.ts script/finish-schoolbook-student-rewrites.ts 729 730
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "../shared/schema";
import { inArray, eq } from "drizzle-orm";
import {
  generateIllustrationsOnly,
  runPublishPipelineGate,
  publishDraft,
  createPdfFromContent,
} from "../server/contentStudio";
import { countUnprocessedIllustrationMarkers } from "@shared/activityBookContent";
import { scanEducationalPedagogySignals } from "@shared/educationalBookQuality";

const argIds = process.argv.slice(2).map((a) => parseInt(a, 10)).filter((n) => !Number.isNaN(n));
const DEFAULT_IDS = [729, 730, 731, 732, 733, 735, 738];
const ids = argIds.length ? argIds : DEFAULT_IDS;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const MAX_WAIT_MS = 14 * 60 * 60 * 1000;
const POLL_MS = 60_000;
const done = new Set<number>();
const failed = new Set<number>();

async function loadTargets() {
  return db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
}

async function finishOne(draftId: number): Promise<"published" | "failed" | "skip"> {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!d) {
    log(`#${draftId} missing — skip`);
    return "skip";
  }
  if (d.status === "published") {
    log(`#${draftId} already published`);
    const [cat] = await db.select().from(books).where(eq(books.sourceDraftId, draftId));
    if (cat && !cat.visible) {
      await db.update(books).set({ visible: true }).where(eq(books.id, cat.id));
      log(`#${draftId} restored catalog #${cat.id} visibility`);
    }
    return "published";
  }
  if (d.status === "generating") return "skip";

  const words = (d.content || "").split(/\s+/).filter(Boolean).length;
  // Do not start a second generateContentForDraft here — the rewrite runner owns writing.
  // This script only illustrates / gates / publishes finished manuscripts.
  if (words < 8000) {
    log(`#${draftId} only ${words} words — waiting for rewrite runner (not generating here)`);
    return "skip";
  }

  let [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!fresh) return "failed";

  const pending = countUnprocessedIllustrationMarkers(fresh.content || "");
  if (pending > 0) {
    log(`#${draftId} ${pending} pending illustration(s) — generating`);
    try {
      await generateIllustrationsOnly([draftId]);
      // generateIllustrationsOnly may run async batch; wait for markers to clear
      const illusDeadline = Date.now() + 3 * 60 * 60 * 1000;
      while (Date.now() < illusDeadline) {
        [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
        const left = countUnprocessedIllustrationMarkers(fresh?.content || "");
        if (left === 0) break;
        log(`#${draftId} waiting on illustrations (${left} left)...`);
        await new Promise((r) => setTimeout(r, 45_000));
      }
    } catch (err: any) {
      log(`#${draftId} illustrations FAIL: ${err?.message || err}`);
    }
  }

  [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!fresh) return "failed";

  const adult = scanEducationalPedagogySignals(fresh.content || "");
  if (adult.issues.length) {
    log(`#${draftId} pedagogy/voice issues: ${adult.issues.join("; ")}`);
  }

  const gate = await runPublishPipelineGate(fresh, { strict: true });
  if (!gate.pass) {
    log(`#${draftId} STRICT GATE FAIL: ${gate.issues.join("; ")}`);
    if (fresh.status === "ready") {
      await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, draftId));
    }
    return "failed";
  }

  if (fresh.status !== "ready" && fresh.status !== "published") {
    await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, draftId));
    const pdfUrl = await createPdfFromContent(fresh.title || "", fresh.content || "");
    if (pdfUrl) {
      await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, draftId));
    }
    log(`#${draftId} promoted to ready`);
  }

  try {
    const bookId = await publishDraft(draftId);
    log(`#${draftId} PUBLISHED → catalog #${bookId}`);
    return "published";
  } catch (err: any) {
    log(`#${draftId} publish FAIL: ${err?.message || err}`);
    return "failed";
  }
}

log(`Schoolbook finish runner started for: ${ids.join(", ")}`);

const start = Date.now();
while (Date.now() - start < MAX_WAIT_MS) {
  const drafts = await loadTargets();
  const generating = drafts.filter((d) => d.status === "generating");
  const pending = drafts.filter((d) => !done.has(d.id) && !failed.has(d.id));

  if (pending.length === 0) {
    log("All targets resolved.");
    break;
  }

  if (generating.length > 0) {
    log(
      `Waiting for generation: ${generating.map((d) => `#${d.id}`).join(", ")} ` +
        `(${pending.length} still open)`,
    );
    await new Promise((r) => setTimeout(r, POLL_MS));
    continue;
  }

  // Only finish manuscripts that already have substantial content (rewrite owns writing).
  const readyToFinish = pending.filter((d) => {
    if (d.status === "generating") return false;
    const words = (d.content || "").split(/\s+/).filter(Boolean).length;
    return words >= 8000 || d.status === "ready";
  });

  if (readyToFinish.length === 0) {
    const thin = pending
      .map((d) => `#${d.id}:${(d.content || "").split(/\s+/).filter(Boolean).length}w`)
      .join(", ");
    log(`Waiting for rewrite content (${thin})...`);
    await new Promise((r) => setTimeout(r, POLL_MS));
    continue;
  }

  const d = readyToFinish.sort((a, b) => a.id - b.id)[0];
  const words = (d.content || "").split(/\s+/).filter(Boolean).length;
  log(`Finishing #${d.id} ${d.title} (status=${d.status}, words=${words})...`);
  const result = await finishOne(d.id);
  if (result === "published") done.add(d.id);
  else if (result === "failed") failed.add(d.id);
  else {
    // skip — content still thin; wait for rewrite
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

log(`Done. published=[${[...done].join(",")}] failed=[${[...failed].join(",")}]`);
const final = await loadTargets();
for (const d of final.sort((a, b) => a.id - b.id)) {
  const [cat] = await db.select().from(books).where(eq(books.sourceDraftId, d.id));
  log(
    `  #${d.id} status=${d.status} words=${(d.content || "").split(/\s+/).filter(Boolean).length}` +
      (cat ? ` catalog=#${cat.id} visible=${cat.visible}` : " catalog=none"),
  );
}
process.exit(failed.size > 0 && done.size === 0 ? 1 : 0);
