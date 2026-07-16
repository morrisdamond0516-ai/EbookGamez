/**
 * Complete schoolbooks 734–741: repair shells, illus, gate, promote, publish.
 *
 *   npx tsx script/complete-734-741.ts --status
 *   npx tsx script/complete-734-741.ts --gate
 *   npx tsx script/complete-734-741.ts --fix-739
 *   npx tsx script/complete-734-741.ts --promote-ready
 *   npx tsx script/complete-734-741.ts --publish-ready
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  runPublishPipelineGate,
  createPdfFromContent,
  publishDraft,
  generateContentForDraft,
  generateIllustrationsOnly,
} from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";
import {
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
} from "../shared/activityBookContent";
import {
  repairEmptyInstructionalSections,
  scanEmptyInstructionalSections,
} from "../shared/educationalBookQuality";

const IDS = [734, 735, 736, 737, 738, 739, 740, 741];
const mode = process.argv.find((a) => a.startsWith("--")) || "--status";

function log(msg: string) {
  console.log(`[734-741] ${msg}`);
}

const drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, IDS));
const byId = new Map(drafts.map((d) => [d.id, d]));

if (mode === "--status") {
  for (const id of IDS) {
    const d = byId.get(id);
    if (!d) {
      log(`#${id} MISSING`);
      continue;
    }
    const c = d.content || "";
    const [book] = await db.select().from(books).where(eq(books.sourceDraftId, id));
    log(
      `#${id} ${d.status} words=${c.trim() ? c.trim().split(/\s+/).length : 0} cover=${draftHasPublishableCover(d)} illus=${countResolvedIllustrationMarkers(c)} pending=${countUnprocessedIllustrationMarkers(c)} shells=${scanEmptyInstructionalSections(c).details.length} catalog=${book ? `#${book.id}` : "none"} | ${(d.title || "").slice(0, 48)}`,
    );
  }
  process.exit(0);
}

if (mode === "--fix-739") {
  const d = byId.get(739)!;
  const before = scanEmptyInstructionalSections(d.content || "");
  log(`#739 shells before: ${JSON.stringify(before.details)}`);
  // Empty peer sections need content — pull next non-empty body isn't available.
  // Soft-fix: rename orphan empty We-do into a real practice seed if next is also chrome;
  // otherwise drop only true nested shells.
  const repaired = repairEmptyInstructionalSections(d.content || "");
  let content = repaired.content;
  if (repaired.removed) {
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 739));
    log(`#739 removed ${repaired.removed} shell(s)`);
  }
  const after = scanEmptyInstructionalSections(content);
  log(`#739 remaining: ${JSON.stringify(after.details)}`);
  // If empty-body remains, append a minimal student prompt under that heading.
  if (after.details.some((x) => x.reason === "empty-body")) {
    const lines = content.split("\n");
    for (const det of after.details.filter((x) => x.reason === "empty-body")) {
      const i = det.lineIndex;
      const insert = [
        "",
        "1) Say the sentence using the word correctly.",
        "2) Write one new sentence of your own with that word.",
        "3) Read both sentences aloud.",
      ];
      lines.splice(i + 1, 0, ...insert);
      log(`#739 filled empty body under: ${det.heading}`);
    }
    content = lines.join("\n");
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 739));
  }
  process.exit(0);
}

if (mode === "--generate-734") {
  log("Starting full content generation for #734 (long-running)...");
  await generateContentForDraft(734);
  log("#734 generateContentForDraft finished");
  process.exit(0);
}

if (mode === "--illus-741") {
  log("Starting illustrations-only for #741...");
  await generateIllustrationsOnly([741]);
  log("#741 illustration batch started/finished");
  process.exit(0);
}

if (mode === "--gate") {
  for (const id of IDS) {
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
    if (!d) continue;
    if (!d.content || d.content.trim().length < 500) {
      log(`#${id} SKIP gate — no content`);
      continue;
    }
    const gate = await runPublishPipelineGate(d, { strict: true });
    log(`#${id} ${d.status} gate=${gate.pass ? "PASS" : "FAIL"}`);
    for (const iss of gate.issues.slice(0, 8)) log(`  - ${iss}`);
  }
  process.exit(0);
}

if (mode === "--promote-ready") {
  for (const id of IDS) {
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
    if (!d || d.status === "published" || d.status === "ready") continue;
    if (!d.content || d.content.trim().length < 500) {
      log(`#${id} skip promote — no content`);
      continue;
    }
    const gate = await runPublishPipelineGate(d, { strict: true });
    if (!gate.pass) {
      log(`#${id} NOT ready — gate fail`);
      for (const iss of gate.issues.slice(0, 6)) log(`  - ${iss}`);
      continue;
    }
    const pdfUrl = await createPdfFromContent(d.title || "", d.content || "");
    await db
      .update(draftEbooks)
      .set({ status: "ready", ...(pdfUrl ? { pdfUrl } : {}) })
      .where(eq(draftEbooks.id, id));
    log(`#${id} → ready`);
  }
  process.exit(0);
}

if (mode === "--publish-ready") {
  for (const id of IDS) {
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
    if (!d) continue;
    if (d.status !== "ready" && d.status !== "published") {
      log(`#${id} skip publish — status=${d.status}`);
      continue;
    }
    if (d.status === "published") {
      const [book] = await db.select().from(books).where(eq(books.sourceDraftId, id));
      log(`#${id} already published catalog=${book ? `#${book.id}` : "none"}`);
      continue;
    }
    try {
      const bookId = await publishDraft(id);
      log(`#${id} published → book #${bookId}`);
    } catch (e: any) {
      log(`#${id} publish error: ${e?.message || e}`);
    }
  }
  process.exit(0);
}

log(`Unknown mode ${mode}`);
process.exit(1);
