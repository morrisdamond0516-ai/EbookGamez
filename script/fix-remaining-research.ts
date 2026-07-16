/**
 * Fix remaining research-batch issues: repair, realign art, publish passers.
 *   npx tsx script/fix-remaining-research.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  repairIncompleteChapters,
  runPublishPipelineGate,
  bulkPublishReady,
  createPdfFromContent,
} from "../server/contentStudio";
import {
  realignResolvedIllustrationsToOutline,
  findIllegalAdjacentIllustrations,
  parseOutlineIllustrationSlots,
} from "../shared/outlineIllustrations";
import { countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

function spreadAdjacent(content: string, outline: string | null): string {
  let updated = content;
  for (let pass = 0; pass < 30; pass++) {
    const issues = findIllegalAdjacentIllustrations(updated, outline);
    if (issues.length === 0) break;
    const markers = [...updated.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
    let moved = false;
    for (let i = 0; i < markers.length - 1; i++) {
      const end = markers[i].index! + markers[i][0].length;
      const startNext = markers[i + 1].index!;
      if (updated.substring(end, startNext).trim().split(/\s+/).filter(Boolean).length > 5) continue;
      const markerToMove = markers[i + 1][0];
      const markerStart = markers[i + 1].index!;
      const chapters = [...updated.matchAll(/##\s*Chapter\s+(\d+)/gi)];
      let chStart = 0;
      let chEnd = updated.length;
      for (let ci = 0; ci < chapters.length; ci++) {
        if (chapters[ci].index! <= markerStart) {
          chStart = chapters[ci].index!;
          chEnd = ci + 1 < chapters.length ? chapters[ci + 1].index! : updated.length;
        }
      }
      const paragraphs = updated
        .substring(chStart, chEnd)
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 40 && !p.includes("[ILLUSTRATION:"));
      const afterPos = markerStart + markerToMove.length;
      const anchor = paragraphs.find((p) => {
        const pos = updated.indexOf(p, afterPos);
        return pos >= chStart && pos < chEnd && pos > afterPos + 20;
      });
      if (!anchor) continue;
      const without = updated.substring(0, markerStart) + updated.substring(markerStart + markerToMove.length);
      const insertAt = without.indexOf(anchor, chStart) + anchor.length;
      updated =
        without.substring(0, insertAt) +
        `\n\n${markerToMove.trim()}\n\n` +
        without.substring(insertAt);
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return updated.replace(/\n{3,}/g, "\n\n");
}

async function promoteIfPass(id: number) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d) return;
  const gate = await runPublishPipelineGate(d, { strict: true });
  if (!gate.pass) {
    console.log(`#${id} still FAIL: ${gate.issues.slice(0, 3).join("; ")}`);
    return;
  }
  if (d.status !== "published") {
    await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, id));
  }
  if (!d.pdfUrl && d.content) {
    const pdfUrl = await createPdfFromContent(d.title || "", d.content);
    if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, id));
  }
  console.log(`#${id} gate PASS → ready`);
}

console.log("=== Fix #714 — repair stub Ch6 ===\n");
try {
  await repairIncompleteChapters(714);
  console.log("#714 chapter repair done");
} catch (e: any) {
  console.error("#714 repair error:", e?.message);
}

console.log("\n=== Fix #725 — realign + spread illustrations ===\n");
{
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 725));
  if (d?.content) {
    let content = d.content;
    const slots = parseOutlineIllustrationSlots(d.outline);
    if (slots.length > 0) {
      const { content: realigned } = realignResolvedIllustrationsToOutline(content, d.outline);
      content = realigned;
    }
    content = spreadAdjacent(content, d.outline);
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 725));
    const gate = await runPublishPipelineGate({ ...d, content }, { strict: true });
    console.log(`#725 after realign/spread: gate=${gate.pass ? "PASS" : "FAIL"}`, gate.issues.slice(0, 3).join("; "));
    if (!d.pdfUrl) {
      const pdfUrl = await createPdfFromContent(d.title || "", content);
      if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, 725));
    }
  }
}

console.log("\n=== Fix #727 — realign (resolved URLs only) ===\n");
{
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 727));
  if (d?.content && countUnprocessedIllustrationMarkers(d.content) === 0) {
    const { content } = realignResolvedIllustrationsToOutline(d.content, d.outline);
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 727));
    const gate = await runPublishPipelineGate({ ...d, content }, { strict: true });
    console.log(`#727 after realign: gate=${gate.pass ? "PASS" : "FAIL"}`, gate.issues.slice(0, 2).join("; "));
    const pdfUrl = await createPdfFromContent(d.title || "", content);
    if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, 727));
  }
}

console.log("\n=== Promote passers → ready ===\n");
for (const id of [708, 709, 714, 715, 725, 727]) {
  await promoteIfPass(id);
}

console.log("\n=== Bulk publish ready ===\n");
const pub = await bulkPublishReady();
console.log(`Published: ${pub.published}, failed: ${pub.failed}`);
for (const d of pub.details) {
  if (d.action !== "published") console.log(`  #${d.id} ${d.action}: ${(d.issues || []).slice(0, 2).join("; ")}`);
}

console.log("\n=== Final status ===\n");
for (const id of [708, 709, 714, 715, 725, 727]) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d) continue;
  const gate = await runPublishPipelineGate(d, { strict: true });
  console.log(`#${id} [${d.status}] gate=${gate.pass ? "PASS" : "FAIL"} | ${(d.title || "").slice(0, 35)}`);
}
