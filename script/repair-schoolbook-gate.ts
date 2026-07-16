/**
 * Targeted schoolbook gate repairs: missing final-chapter illus, lonely islands,
 * back-to-back spacing, duplicate chapters, adult-voice phrases.
 *
 *   npx tsx --import ./script/load-env.ts script/repair-schoolbook-gate.ts
 *   npx tsx --import ./script/load-env.ts script/repair-schoolbook-gate.ts 729 730 --publish
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  generateIllustrations,
  runPublishPipelineGate,
  publishDraft,
  createPdfFromContent,
  repairIncompleteChapters,
} from "../server/contentStudio";
import {
  parseOutlineIllustrationSlots,
  injectOutlineIllustrationSlots,
  findIllegalAdjacentIllustrations,
  outlineDescriptionKey,
} from "../shared/outlineIllustrations";
import { isEducationalGenre } from "../shared/educationalBookQuality";
import { countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

const argIds = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => parseInt(a, 10))
  .filter((n) => !Number.isNaN(n));
const DEFAULT_IDS = [729, 730, 731, 732, 733, 735, 738];
const ids = argIds.length ? argIds : DEFAULT_IDS;
const doPublish = process.argv.includes("--publish");

function log(msg: string) {
  console.log(`[repair] ${msg}`);
}

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
      const key = outlineDescriptionKey(d1);
      const idx = slots.findIndex((s) => outlineDescriptionKey(s.description) === key);
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

function isLonelyIsland(textBetween: string): boolean {
  const wordsBetween = textBetween.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordsBetween > 20) return false;
  const lines = textBetween
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "---");
  return (
    lines.length > 0 &&
    lines.length <= 4 &&
    lines.every(
      (l) =>
        /^[-•*]\s+/.test(l) ||
        /^\d+\.\s+/.test(l) ||
        /^#{1,6}\s/.test(l) ||
        /^\*\*[^*]+\*\*\s*:?\s*$/.test(l),
    )
  );
}

const BRIDGE_PARAGRAPHS = [
  "Look at the picture and think about how it connects to what you just learned. Use the details you see to explain the idea in your own words. When you feel ready, try the practice below to show what you know.",
  "The illustration helps you see the idea more clearly. Notice the important parts and how they fit together. Then use what you learned to answer the questions and complete the practice on your own.",
  "Use this figure to check your understanding. Study what is shown and connect it to the lesson steps you read. Practice the skill yourself so you can remember it later.",
  "Pictures in your textbook help you learn step by step. Look carefully at what is happening in the image. Then try the exercises below to practice the same skill.",
];

function bridgeLonelyInstructionalIslands(content: string): { content: string; bridged: number } {
  let updated = content;
  let bridged = 0;
  let safety = 0;
  let bridgeIdx = 0;

  while (safety++ < 30) {
    const illMarkers = [...updated.matchAll(/\[ILLUSTRATION:[^\]]+\]/g)];
    let fixed = false;

    for (let i = 0; i < illMarkers.length - 1; i++) {
      const endOfCurrent = illMarkers[i].index! + illMarkers[i][0].length;
      const startOfNext = illMarkers[i + 1].index!;
      const textBetween = updated.substring(endOfCurrent, startOfNext).trim();
      const wordsBetween = textBetween.split(/\s+/).filter((w) => w.length > 0).length;
      if (wordsBetween > 5 && wordsBetween < 30 && isLonelyIsland(textBetween)) {
        const bridge = BRIDGE_PARAGRAPHS[bridgeIdx % BRIDGE_PARAGRAPHS.length];
        bridgeIdx++;
        updated =
          updated.substring(0, endOfCurrent) +
          `\n\n${bridge}\n\n` +
          updated.substring(endOfCurrent);
        bridged++;
        fixed = true;
        break;
      }
    }

    if (!fixed) break;
  }

  return { content: updated.replace(/\n{3,}/g, "\n\n"), bridged };
}

function removeDuplicateChapters(content: string): { content: string; removed: number } {
  const headers = [...content.matchAll(/##\s*Chapter\s+(\d+)[^\n]*/gi)];
  const byNum = new Map<number, { start: number; end: number; words: number }[]>();

  for (let i = 0; i < headers.length; i++) {
    const num = parseInt(headers[i][1], 10);
    const start = headers[i].index!;
    const end = i + 1 < headers.length ? headers[i + 1].index! : content.length;
    const text = content.substring(start, end);
    const words = text.split(/\s+/).filter(Boolean).length;
    if (!byNum.has(num)) byNum.set(num, []);
    byNum.get(num)!.push({ start, end, words });
  }

  const toRemove: { start: number; end: number }[] = [];
  for (const [, sections] of byNum) {
    if (sections.length <= 1) continue;
    sections.sort((a, b) => b.words - a.words);
    for (let i = 1; i < sections.length; i++) {
      toRemove.push({ start: sections[i].start, end: sections[i].end });
    }
  }

  if (toRemove.length === 0) return { content, removed: 0 };

  toRemove.sort((a, b) => b.start - a.start);
  let updated = content;
  for (const r of toRemove) {
    updated = updated.substring(0, r.start) + updated.substring(r.end);
  }

  return { content: updated.replace(/\n{3,}/g, "\n\n").trim(), removed: toRemove.length };
}

function injectMissingChapterIllustrations(
  content: string,
  outline: string | null | undefined,
): { content: string; injected: number } {
  const slots = parseOutlineIllustrationSlots(outline);
  if (slots.length === 0) return { content, injected: 0 };

  const chapters = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  const emptyChapters = new Set<number>();

  for (let i = 0; i < chapters.length; i++) {
    const chNum = parseInt(chapters[i][1], 10);
    const chStart = chapters[i].index!;
    const chEnd = i + 1 < chapters.length ? chapters[i + 1].index! : content.length;
    const chText = content.substring(chStart, chEnd);
    const resolved = (chText.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    if (resolved === 0) {
      const outlineForCh = slots.filter((s) => s.chapterNum === chNum);
      if (outlineForCh.length > 0) emptyChapters.add(chNum);
    }
  }

  if (emptyChapters.size === 0) return { content, injected: 0 };

  const filteredSlots = slots.filter((s) => emptyChapters.has(s.chapterNum));
  const { content: updated, injected } = injectOutlineIllustrationSlots(content, filteredSlots);
  return { content: updated, injected };
}

function fixAdultFacingPhrases(content: string): { content: string; fixes: number } {
  let fixes = 0;
  const replacements: [RegExp, string][] = [
    [/\byour child\b/gi, "you"],
    [/\byour student\b/gi, "you"],
    [/\bas a parent\b/gi, "as you learn"],
    [/\bin your classroom\b/gi, "in class"],
    [/\bhomeschool(?:ing)?\b/gi, "at home"],
    [/\bparents can\b/gi, "you can"],
    [/\bteachers can\b/gi, "you can"],
    [/\bhelp your child\b/gi, "help yourself"],
    [/\bask your student\b/gi, "ask yourself"],
    [/\bwith your child\b/gi, "on your own"],
    [/\bfor your child\b/gi, "for yourself"],
    [/\bhave your child\b/gi, "try to"],
    [/\blet your child\b/gi, "try to"],
    [/\bguide your child\b/gi, "practice"],
    [/\byour learner\b/gi, "you"],
  ];

  let updated = content;
  for (const [re, rep] of replacements) {
    const before = updated;
    updated = updated.replace(re, (match) => {
      fixes++;
      if (match[0] === match[0].toUpperCase()) {
        return rep.charAt(0).toUpperCase() + rep.slice(1);
      }
      return rep;
    });
    if (before !== updated) {
      // count already incremented per match
    }
  }

  return { content: updated, fixes };
}

async function waitForIllustrations(draftId: number, maxMs = 3 * 60 * 60 * 1000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
    const left = countUnprocessedIllustrationMarkers(d?.content || "");
    if (left === 0) return true;
    log(`#${draftId} waiting on ${left} illustration(s)...`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  return false;
}

async function repairOne(draftId: number): Promise<{ pass: boolean; published: boolean; issues: string[] }> {
  const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!draft?.content) {
    log(`#${draftId} missing content`);
    return { pass: false, published: false, issues: ["no content"] };
  }

  log(`#${draftId} ${draft.title} — starting repairs`);
  let content = draft.content;
  const outline = draft.outline;

  // 1) Adult voice (732 especially)
  const adult = fixAdultFacingPhrases(content);
  if (adult.fixes > 0) {
    content = adult.content;
    log(`#${draftId} adult-voice fixes: ${adult.fixes}`);
  }

  // 2) Duplicate chapters
  const dedup = removeDuplicateChapters(content);
  if (dedup.removed > 0) {
    content = dedup.content;
    log(`#${draftId} removed ${dedup.removed} duplicate chapter section(s)`);
  }

  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draftId));

  // 3) Rewrite too-short chapters (730 Ch12)
  const gatePre = await runPublishPipelineGate({ ...draft, content }, { strict: true });
  const needsChapterRepair = gatePre.issues.some(
    (i) => /too short/i.test(i) || /truncated/i.test(i) || /placeholder/i.test(i),
  );
  if (needsChapterRepair) {
    log(`#${draftId} running repairIncompleteChapters...`);
    content = await repairIncompleteChapters(draftId);
    const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
    content = fresh?.content || content;
  }

  // 4) Inject missing final-chapter illustrations from outline
  const inject = injectMissingChapterIllustrations(content, outline);
  if (inject.injected > 0) {
    content = inject.content;
    log(`#${draftId} injected ${inject.injected} outline illustration marker(s)`);
  }

  // 5) Bridge lonely instructional islands
  const bridge = bridgeLonelyInstructionalIslands(content);
  if (bridge.bridged > 0) {
    content = bridge.content;
    log(`#${draftId} bridged ${bridge.bridged} lonely island(s)`);
  }

  // 6) Spread back-to-back illustrations
  const spread = spreadIllegalAdjacentIllustrations(content, outline);
  if (spread.moved > 0) {
    content = spread.content;
    log(`#${draftId} spread ${spread.moved} back-to-back illustration(s)`);
  }

  await db.update(draftEbooks).set({ content, status: "draft" }).where(eq(draftEbooks.id, draftId));

  // 7) Generate pending illustrations
  const pending = countUnprocessedIllustrationMarkers(content);
  if (pending > 0) {
    log(`#${draftId} generating ${pending} illustration(s)...`);
    try {
      content = await generateIllustrations(content, draft.genre || "Textbooks", draft.title || "", draftId);
      await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draftId));
      log(`#${draftId} illustrations generated`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`#${draftId} illustration generation error: ${msg}`);
    }
  }

  // Re-bridge / re-spread after illustration generation may shift layout
  const [afterIllus] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  content = afterIllus?.content || content;
  const bridge2 = bridgeLonelyInstructionalIslands(content);
  const spread2 = spreadIllegalAdjacentIllustrations(bridge2.content, outline);
  if (bridge2.bridged > 0 || spread2.moved > 0) {
    content = spread2.content;
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draftId));
    log(`#${draftId} post-illus layout: bridged=${bridge2.bridged} spread=${spread2.moved}`);
  }

  const [final] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  const gate = await runPublishPipelineGate(final!, { strict: true });
  log(`#${draftId} gate: ${gate.pass ? "PASS" : "FAIL"}`);
  for (const issue of gate.issues) log(`  - ${issue}`);

  if (!gate.pass) {
    return { pass: false, published: false, issues: gate.issues };
  }

  if (final!.status !== "ready" && final!.status !== "published") {
    await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, draftId));
    const pdfUrl = await createPdfFromContent(final!.title || "", final!.content || "");
    if (pdfUrl) {
      await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, draftId));
    }
    log(`#${draftId} promoted to ready`);
  }

  if (doPublish) {
    try {
      const bookId = await publishDraft(draftId);
      log(`#${draftId} PUBLISHED → catalog #${bookId}`);
      return { pass: true, published: true, issues: [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`#${draftId} publish failed: ${msg}`);
      return { pass: true, published: false, issues: [msg] };
    }
  }

  return { pass: true, published: false, issues: [] };
}

console.log(`Repair schoolbook gate for: ${ids.join(", ")} publish=${doPublish}`);
const results: Record<number, { pass: boolean; published: boolean; issues: string[] }> = {};

for (const id of ids) {
  try {
    results[id] = await repairOne(id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`#${id} FATAL: ${msg}`);
    results[id] = { pass: false, published: false, issues: [msg] };
  }
}

console.log("\n=== SUMMARY ===");
const rows = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
for (const d of rows.sort((a, b) => a.id - b.id)) {
  const [cat] = await db.select().from(books).where(eq(books.sourceDraftId, d.id));
  const r = results[d.id];
  console.log(
    `#${d.id} status=${d.status} gate=${r?.pass ? "PASS" : "FAIL"} published=${r?.published ? "yes" : "no"}` +
      (cat ? ` catalog=#${cat.id} visible=${cat.visible}` : " catalog=none") +
      (r?.issues?.length ? ` issues=${r.issues.slice(0, 2).join("; ")}` : ""),
  );
}

process.exit(Object.values(results).every((r) => r.pass && (!doPublish || r.published)) ? 0 : 1);
