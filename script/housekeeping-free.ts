/**
 * Free library housekeeping — no API calls.
 *   npx tsx script/housekeeping-free.ts
 *   npx tsx script/housekeeping-free.ts --spread-illus 723 725
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";
import {
  runPublishPipelineGate,
  createPdfFromContent,
  passesFreeIllustrationAndOutlineGate,
} from "../server/contentStudio";
import { parseOutlineIllustrationSlots, findIllegalAdjacentIllustrations, realignResolvedIllustrationsToOutline } from "../shared/outlineIllustrations";

/** Move resolved illustration markers apart when outline does not allow adjacency. */
function spreadIllegalAdjacentIllustrations(
  content: string,
  outline: string | null | undefined,
): { content: string; moved: number } {
  const slots = parseOutlineIllustrationSlots(outline);
  let updated = content;
  let moved = 0;
  let safety = 0;

  while (safety++ < 50) {
    const issues = findIllegalAdjacentIllustrations(updated, outline);
    if (issues.length === 0) break;

    const markers = [...updated.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
    let fixed = false;

    for (let i = 0; i < markers.length - 1; i++) {
      const end = markers[i].index! + markers[i][0].length;
      const startNext = markers[i + 1].index!;
      const between = updated.substring(end, startNext).trim();
      const words = between.split(/\s+/).filter(Boolean).length;
      if (words > 5) continue;

      const d1 = markers[i][1].trim().split("|")[0];
      const key = d1.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim().slice(0, 80);
      const idx = slots.findIndex(
        (s) =>
          s.description
            .toLowerCase()
            .replace(/\s+/g, " ")
            .replace(/[^a-z0-9 ]/g, "")
            .trim()
            .slice(0, 80) === key,
      );
      if (idx >= 0 && slots[idx].allowAdjacentWithNext) continue;

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

      const chapterText = updated.substring(chStart, chEnd);
      const paragraphs = chapterText
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
      moved++;
      fixed = true;
      break;
    }

    if (!fixed) break;
  }

  return { content: updated.replace(/\n{3,}/g, "\n\n"), moved };
}

const realignIds = (() => {
  const i = process.argv.indexOf("--realign-illus");
  if (i < 0) return [] as number[];
  return process.argv
    .slice(i + 1)
    .map((a) => parseInt(a, 10))
    .filter((n) => !Number.isNaN(n));
})();

const spreadIds = (() => {
  const i = process.argv.indexOf("--spread-illus");
  if (i < 0) return [] as number[];
  return process.argv
    .slice(i + 1)
    .map((a) => parseInt(a, 10))
    .filter((n) => !Number.isNaN(n));
})();

console.log("=== Free housekeeping (no API) ===\n");

// 1) Unstick generating drafts with partial/complete content
const generating = await db.select().from(draftEbooks).where(eq(draftEbooks.status, "generating"));
for (const d of generating) {
  const words = (d.content || "").split(/\s+/).length;
  if (words > 1000) {
    await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, d.id));
    console.log(`Unstuck #${d.id} "${d.title}" generating → draft (${words} words)`);
  }
}

// 2) Demote ready drafts that fail quality gate
const ready = await db.select().from(draftEbooks).where(eq(draftEbooks.status, "ready"));
for (const d of ready) {
  const gate = await runPublishPipelineGate(d, { strict: true });
  if (!gate.pass) {
    await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, d.id));
    console.log(`Demoted #${d.id} "${d.title}" ready → draft: ${gate.issues[0]}`);
  }
}

// 3) Realign illustrations to outline anchors (optional IDs; skips activity books with pending markers)
if (realignIds.length > 0) {
  const rows = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, realignIds));
  for (const d of rows) {
    const pendingBefore = (d.content || "").match(/\[ILLUSTRATION:\s*(?!\/|http)[^\]]+\]/gi)?.length || 0;
    if (pendingBefore > 0 && /activity/i.test(d.genre || "")) {
      console.log(`#${d.id} skip realign — activity book has ${pendingBefore} pending marker(s) needing image API`);
      continue;
    }
    const beforeIssues = findIllegalAdjacentIllustrations(d.content || "", d.outline).length;
    const { content, realigned, pending } = realignResolvedIllustrationsToOutline(d.content || "", d.outline);
    const gate = passesFreeIllustrationAndOutlineGate(content, d.genre, d.outline);
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, d.id));
    const afterIssues = findIllegalAdjacentIllustrations(content, d.outline).length;
    console.log(
      `#${d.id} realigned ${realigned} URL(s), ${pending} pending, adjacency ${beforeIssues}→${afterIssues}, gate=${gate.pass ? "PASS" : "FAIL"}`,
    );
    if (gate.pass) {
      await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, d.id));
      if (!d.pdfUrl) {
        const pdfUrl = await createPdfFromContent(d.title || "", content);
        if (pdfUrl) await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, d.id));
      }
    }
  }
}

// 4) Spread back-to-back illustrations (optional IDs)
if (spreadIds.length > 0) {
  const rows = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, spreadIds));
  for (const d of rows) {
    const before = findIllegalAdjacentIllustrations(d.content || "", d.outline).length;
    const { content, moved } = spreadIllegalAdjacentIllustrations(d.content || "", d.outline);
    if (moved > 0) {
      await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, d.id));
      const after = findIllegalAdjacentIllustrations(content, d.outline).length;
      console.log(`#${d.id} spread ${moved} illustration(s): adjacency issues ${before} → ${after}`);
    } else {
      console.log(`#${d.id} no movable adjacency fixes`);
    }
  }
}

// 5) PDFs for ready + published drafts that pass gate
const needPdf = await db
  .select()
  .from(draftEbooks)
  .where(sql`${draftEbooks.status} IN ('ready', 'published') AND (${draftEbooks.pdfUrl} IS NULL OR ${draftEbooks.pdfUrl} = '')`);
for (const d of needPdf) {
  const gate = await runPublishPipelineGate(d, { strict: true });
  if (!gate.pass) continue;
  const pdfUrl = await createPdfFromContent(d.title || "", d.content || "");
  if (pdfUrl) {
    await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, d.id));
    console.log(`PDF created #${d.id} "${d.title}" [${d.status}]`);
  }
}

// 6) Summary
const counts: Record<string, number> = {};
const all = await db.select({ status: draftEbooks.status }).from(draftEbooks);
for (const r of all) counts[r.status] = (counts[r.status] || 0) + 1;
console.log("\nStatus counts:", counts);

const research = [707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728];
console.log("\nResearch batch:");
for (const id of research) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d) continue;
  const gate = await runPublishPipelineGate(d, { strict: true });
  const words = (d.content || "").split(/\s+/).length;
  console.log(
    `#${id} [${d.status}] ${words}w gate=${gate.pass ? "PASS" : "FAIL"} pdf=${!!d.pdfUrl} | ${(d.title || "").slice(0, 35)}`,
  );
}
