/**
 * Deterministic (mostly free) layout/illustration-placement repairs used when
 * the publish gate fails after dialogue + illustrations have already run.
 * Keeps books from sitting stuck in `draft` when the fix is structural/layout.
 */

import {
  parseOutlineIllustrationSlots,
  injectOutlineIllustrationSlots,
  findIllegalAdjacentIllustrations,
  outlineDescriptionKey,
} from "./outlineIllustrations";
import {
  repairEmptyInstructionalSections,
  scanEmptyInstructionalSections,
  type InstructionalSectionKind,
} from "./educationalBookQuality";

/** Move resolved illustration markers apart when outline does not allow adjacency. */
export function spreadIllegalAdjacentIllustrations(
  content: string,
  outline: string | null | undefined,
): { content: string; moved: number } {
  const slots = parseOutlineIllustrationSlots(outline);
  let updated = content;
  let moved = 0;
  let safety = 0;
  let bridgeIdx = 0;

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

      // Prefer inserting a bridge paragraph — moving markers often recreates adjacency elsewhere.
      const bridge = BRIDGE_PARAGRAPHS[bridgeIdx % BRIDGE_PARAGRAPHS.length];
      bridgeIdx++;
      updated =
        updated.substring(0, end) + `\n\n${bridge}\n\n` + updated.substring(end);
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

/** Insert a short teach/explain paragraph between illustrations that only have chrome. */
export function bridgeLonelyInstructionalIslands(content: string): {
  content: string;
  bridged: number;
} {
  let updated = content;
  let bridged = 0;
  let safety = 0;
  let bridgeIdx = 0;

  while (safety++ < 40) {
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

/** Inject outline illustration markers into chapters that have zero resolved figures. */
export function injectMissingChapterIllustrations(
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
    const resolved = (
      chText.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []
    ).length;
    const pending = (chText.match(/\[ILLUSTRATION:\s*(?!\/|http)[^\]]+\]/gi) || []).length;
    if (resolved === 0 && pending === 0) {
      const outlineForCh = slots.filter((s) => s.chapterNum === chNum);
      if (outlineForCh.length > 0) emptyChapters.add(chNum);
    }
  }

  if (emptyChapters.size === 0) return { content, injected: 0 };

  const filteredSlots = slots.filter((s) => emptyChapters.has(s.chapterNum));
  const { content: updated, injected } = injectOutlineIllustrationSlots(content, filteredSlots);
  return { content: updated, injected };
}

const EMPTY_BODY_SEEDS: Record<InstructionalSectionKind, string[]> = {
  objectives: [
    "- I can explain the main idea from this lesson in my own words.",
    "- I can show one example of the skill.",
    "- I can check my work and fix mistakes.",
  ],
  example: [
    "1) Read the example carefully.",
    "2) Say each step out loud in your own words.",
    "3) Cover the answer and try the same kind of problem yourself.",
  ],
  practice: [
    "1) Try the skill on your own.",
    "2) Write one complete answer.",
    "3) Check your work and revise anything that is unclear.",
  ],
  check: [
    "1) Write one sentence that shows what you learned.",
    "2) Give one example from the lesson.",
    "3) Rate how sure you feel (1–5) and say what you will practice next.",
  ],
  keyterms: [
    "- Write each key term.",
    "- Give a short student-friendly definition.",
    "- Use the term in one original sentence.",
  ],
  review: [
    "1) List three things you learned in this chapter.",
    "2) Write one question you still have.",
    "3) Teach one idea from the chapter to a classmate in your own words.",
  ],
  other: [
    "1) Complete this section using what you learned.",
    "2) Write a clear answer in your own words.",
    "3) Check your work before you move on.",
  ],
};

/** Fill empty Example/Practice/Check headings with minimal student prompts (no API). */
export function fillEmptyInstructionalBodies(content: string): {
  content: string;
  filled: number;
} {
  const scan = scanEmptyInstructionalSections(content);
  const empties = scan.details.filter((d) => d.reason === "empty-body");
  if (empties.length === 0) return { content, filled: 0 };

  const lines = content.split("\n");
  for (const det of [...empties].sort((a, b) => b.lineIndex - a.lineIndex)) {
    const seed = EMPTY_BODY_SEEDS[det.kind] || EMPTY_BODY_SEEDS.other;
    lines.splice(det.lineIndex + 1, 0, "", ...seed);
  }
  return { content: lines.join("\n"), filled: empties.length };
}

/**
 * Apply all free layout/structure repairs that commonly unblock schoolbook/visual gates.
 */
export function applyDeterministicGateRepairs(
  content: string,
  outline: string | null | undefined,
  options?: { educational?: boolean },
): { content: string; repairs: string[] } {
  let updated = content;
  const repairs: string[] = [];

  if (options?.educational !== false) {
    const shells = repairEmptyInstructionalSections(updated);
    if (shells.removed > 0) {
      updated = shells.content;
      repairs.push(`removed ${shells.removed} empty instructional shell(s)`);
    }
    const filled = fillEmptyInstructionalBodies(updated);
    if (filled.filled > 0) {
      updated = filled.content;
      repairs.push(`filled ${filled.filled} empty instructional section(s)`);
    }
  }

  const inject = injectMissingChapterIllustrations(updated, outline);
  if (inject.injected > 0) {
    updated = inject.content;
    repairs.push(`injected ${inject.injected} missing outline illustration marker(s)`);
  }

  const bridge = bridgeLonelyInstructionalIslands(updated);
  if (bridge.bridged > 0) {
    updated = bridge.content;
    repairs.push(`bridged ${bridge.bridged} lonely instructional island(s)`);
  }

  const spread = spreadIllegalAdjacentIllustrations(updated, outline);
  if (spread.moved > 0) {
    updated = spread.content;
    repairs.push(`spread ${spread.moved} back-to-back illustration(s)`);
  }

  return { content: updated.replace(/\n{3,}/g, "\n\n"), repairs };
}
