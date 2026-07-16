/**
 * Outline-driven illustration placement — mirrors Replit pipeline rules:
 * - Illustrations come from the outline's [ILLUSTRATION:] markers per chapter
 * - No back-to-back images unless the outline places them consecutively
 */

import {
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
} from "./activityBookContent";

export type OutlineIllustrationSlot = {
  chapterNum: number;
  description: string;
  /** True when the next outline marker is adjacent (allows side-by-side in content). */
  allowAdjacentWithNext: boolean;
};

export function parseOutlineIllustrationSlots(outline: string | null | undefined): OutlineIllustrationSlot[] {
  if (!outline?.trim()) return [];
  const outlineStr = outline.replace(/<!--[\s\S]*?-->/g, "").trim();
  const slots: OutlineIllustrationSlot[] = [];

  // Do NOT use the /m flag here: with /m, `$` matches end-of-line and non-greedy
  // chapter bodies stop after the title line (breaking `# **Chapter N**` educational outlines).
  // Allow optional markdown bold around "Chapter" (e.g. `# **Chapter 1 — Title**`).
  // Require at least one `#` so mid-line "Chapter N" text does not start a block.
  let chapterBlocks = [
    ...outlineStr.matchAll(
      /(?:^|\n)(#{1,3})\s*\*{0,2}\s*Chapter\s+(\d+)\b([\s\S]*?)(?=(?:^|\n)#{1,3}\s*\*{0,2}\s*Chapter\s+\d+\b|(?![\s\S]))/gi,
    ),
  ];

  // Plain "chapter N" lines (no markdown heading) — only if no hashed chapters found
  if (chapterBlocks.length === 0) {
    chapterBlocks = [
      ...outlineStr.matchAll(
        /(?:^|\n)chapter\s+(\d+)\b([\s\S]*?)(?=(?:^|\n)chapter\s+\d+\b|(?![\s\S]))/gi,
      ),
    ];
  }

  const seen = new Set<number>();
  for (const block of chapterBlocks) {
    // Hashed form captures (#, num, body); plain form captures (num, body)
    const chapterNum = parseInt(block[2] != null && block[3] != null ? block[2] : block[1], 10);
    const text = (block[3] != null ? block[3] : block[2]) || "";
    if (!Number.isFinite(chapterNum) || seen.has(chapterNum)) continue;
    seen.add(chapterNum);
    const markers = [...text.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].map((m) => m[1].trim());
    for (let i = 0; i < markers.length; i++) {
      slots.push({
        chapterNum,
        description: markers[i],
        allowAdjacentWithNext: i < markers.length - 1,
      });
    }
  }

  if (slots.length === 0) {
    const globalMarkers = [...outlineStr.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].map((m) => m[1].trim());
    for (let i = 0; i < globalMarkers.length; i++) {
      slots.push({
        chapterNum: 0,
        description: globalMarkers[i],
        allowAdjacentWithNext: i < globalMarkers.length - 1,
      });
    }
  }

  return slots;
}

/**
 * Insert missing outline illustration markers into chapter prose.
 * chapterNum 0 slots are spread across the book in order.
 */
export function injectOutlineIllustrationSlots(
  content: string,
  slots: OutlineIllustrationSlot[],
): { content: string; injected: number } {
  if (slots.length === 0) return { content, injected: 0 };

  const chapters = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  let updated = content;
  let injected = 0;

  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si];
    let chStart = 0;
    let chEnd = updated.length;

    if (slot.chapterNum > 0 && chapters.length > 0) {
      const chIdx = chapters.findIndex((c) => parseInt(c[1], 10) === slot.chapterNum);
      if (chIdx >= 0) {
        chStart = chapters[chIdx].index!;
        chEnd = chIdx + 1 < chapters.length ? chapters[chIdx + 1].index! : updated.length;
      }
    } else if (chapters.length > 0) {
      const chIdx = Math.min(
        Math.floor((si / slots.length) * chapters.length),
        chapters.length - 1,
      );
      chStart = chapters[chIdx].index!;
      chEnd = chIdx + 1 < chapters.length ? chapters[chIdx + 1].index! : updated.length;
    }

    const chapterText = updated.substring(chStart, chEnd);
    const key = outlineDescriptionKey(slot.description);
    const already = [...chapterText.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].some((m) => {
      const payload = m[1].trim().split("|")[0];
      return (
        outlineDescriptionKey(payload) === key ||
        m[1].trim().startsWith("/") ||
        m[1].trim().startsWith("http")
      );
    });
    if (already) continue;

    const paragraphs = chapterText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30 && !p.startsWith("[ILLUSTRATION:"));
    const slotIndexInChapter = slots
      .slice(0, si + 1)
      .filter((s) => s.chapterNum === slot.chapterNum).length - 1;
    const anchor =
      paragraphs[Math.min(Math.max(0, slotIndexInChapter), paragraphs.length - 1)] ||
      paragraphs[0] ||
      chapterText.split("\n").find((l) => l.trim().length > 40)?.trim();
    if (!anchor) continue;

    const pos = updated.indexOf(anchor, chStart);
    if (pos === -1 || pos >= chEnd) continue;
    const insertPos = pos + anchor.length;
    updated =
      updated.substring(0, insertPos) +
      `\n\n[ILLUSTRATION: ${slot.description}]\n\n` +
      updated.substring(insertPos);
    injected++;
  }

  return { content: updated, injected };
}

export function outlineDescriptionKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .slice(0, 80);
}

/** Remove pending text markers that are not declared in the outline (batch-repair artifacts). */
export function prunePendingMarkersNotInOutline(
  content: string,
  outline: string | null | undefined,
): { content: string; removed: number } {
  const slots = parseOutlineIllustrationSlots(outline);
  if (slots.length === 0) return { content, removed: 0 };

  const allowed = new Set(slots.map((s) => outlineDescriptionKey(s.description)));
  let removed = 0;
  const updated = content.replace(/\[ILLUSTRATION:\s*([^\]]+)\]/gi, (full, inner) => {
    const payload = inner.trim();
    if (payload.startsWith("/") || payload.startsWith("http")) return full;
    const key = outlineDescriptionKey(payload.split("|")[0]);
    if (allowed.has(key)) return full;
    removed++;
    return "";
  });
  return { content: updated.replace(/\n{3,}/g, "\n\n"), removed };
}

/**
 * Undo batch-repair pending marker floods on Replit-finished books:
 * 1) drop pending markers not declared in the outline
 * 2) when resolved art already exists, drop excess unprocessed pending (pending > resolved)
 */
export function revertBatchRepairPendingMarkers(
  content: string,
  outline: string | null | undefined,
): { content: string; removed: number } {
  let working = content;
  let totalRemoved = 0;

  const fromOutline = prunePendingMarkersNotInOutline(working, outline);
  working = fromOutline.content;
  totalRemoved += fromOutline.removed;

  const resolved = countResolvedIllustrationMarkers(working);
  const pending = countUnprocessedIllustrationMarkers(working);
  if (resolved >= 20 && pending > resolved) {
    let removed = 0;
    working = working.replace(/\[ILLUSTRATION:\s*([^\]]+)\]/gi, (full, inner) => {
      const payload = inner.trim();
      if (payload.startsWith("/") || payload.startsWith("http")) return full;
      removed++;
      return "";
    });
    working = working.replace(/\n{3,}/g, "\n\n");
    totalRemoved += removed;
  }

  return { content: working, removed: totalRemoved };
}

/** Detect back-to-back illustration markers not allowed by outline adjacency rules. */
export function findIllegalAdjacentIllustrations(
  content: string,
  outline: string | null | undefined,
): string[] {
  const issues: string[] = [];
  const markers = [...content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
  for (let i = 0; i < markers.length - 1; i++) {
    const end = markers[i].index! + markers[i][0].length;
    const startNext = markers[i + 1].index!;
    const between = content.substring(end, startNext).trim();
    const words = between.split(/\s+/).filter(Boolean).length;
    if (words > 5) continue;

    const slots = parseOutlineIllustrationSlots(outline);
    const d1 = outlineDescriptionKey(markers[i][1].trim().split("|")[0]);
    const idx = slots.findIndex((s) => outlineDescriptionKey(s.description) === d1);
    const outlineAllowsAdjacent = idx >= 0 && slots[idx].allowAdjacentWithNext;
    if (!outlineAllowsAdjacent) {
      issues.push(
        `Back-to-back illustrations with only ${words} word(s) between — outline does not place these adjacent`,
      );
    }
  }
  return issues;
}

/**
 * Replace all illustration markers with outline-exact pending descriptions.
 * Use before regenerating images so the model gets precise directions from the outline,
 * not vague AI-injected or batch-repair text.
 */
export function resetContentIllustrationsToOutline(
  content: string,
  outline: string | null | undefined,
): { content: string; slotCount: number; stripped: number } {
  const slots = parseOutlineIllustrationSlots(outline);
  if (slots.length === 0) return { content, slotCount: 0, stripped: 0 };

  const beforeCount = (content.match(/\[ILLUSTRATION:/gi) || []).length;
  let stripped = content.replace(/\[ILLUSTRATION:\s*[^\]]+\]/gi, "");
  stripped = stripped.replace(/\n{3,}/g, "\n\n");

  const chapters = [...stripped.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  let updated = stripped;
  let injected = 0;

  // Inject from last chapter to first so string indices stay valid.
  const slotsByChapter = new Map<number, OutlineIllustrationSlot[]>();
  for (const slot of slots) {
    const list = slotsByChapter.get(slot.chapterNum) || [];
    list.push(slot);
    slotsByChapter.set(slot.chapterNum, list);
  }

  const chapterNums = [...slotsByChapter.keys()].sort((a, b) => b - a);
  for (const chNum of chapterNums) {
    const chSlots = slotsByChapter.get(chNum) || [];
    const chIdx = chapters.findIndex((c) => parseInt(c[1], 10) === chNum);
    const chStart = chIdx >= 0 ? chapters[chIdx].index! : 0;
    const chEnd =
      chIdx >= 0 && chIdx + 1 < chapters.length ? chapters[chIdx + 1].index! : updated.length;
    const chapterText = updated.substring(chStart, chEnd);
    const paragraphs = chapterText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30 && !p.startsWith("[ILLUSTRATION:"));

    for (let si = chSlots.length - 1; si >= 0; si--) {
      const slot = chSlots[si];
      const anchor =
        paragraphs[Math.min(si, Math.max(0, paragraphs.length - 1))] ||
        paragraphs[0];
      if (!anchor) continue;
      const pos = updated.indexOf(anchor, chStart);
      if (pos === -1) continue;
      const insertPos = pos + anchor.length;
      const marker = `\n\n[ILLUSTRATION: ${slot.description}]\n\n`;
      updated = updated.substring(0, insertPos) + marker + updated.substring(insertPos);
      injected++;
    }
  }

  return { content: updated, slotCount: slots.length, stripped: beforeCount };
}

/**
 * Re-place resolved illustration URLs on outline paragraph anchors (free — no image API).
 * Preserves existing /uploads and /objstore URLs matched by description key; orphans fill missing slots in order.
 */
export function realignResolvedIllustrationsToOutline(
  content: string,
  outline: string | null | undefined,
): { content: string; realigned: number; pending: number } {
  const slots = parseOutlineIllustrationSlots(outline);
  if (slots.length === 0) return { content, realigned: 0, pending: 0 };

  const urlByKey = new Map<string, string>();
  const orphanUrls: string[] = [];
  for (const m of content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)) {
    const inner = m[1].trim();
    const payload = inner.split("|")[0].trim();
    if (payload.startsWith("/") || payload.startsWith("http")) {
      orphanUrls.push(payload);
      continue;
    }
    const key = outlineDescriptionKey(payload);
    if (!urlByKey.has(key)) urlByKey.set(key, payload);
  }

  let orphanIdx = 0;
  const resolvePayload = (description: string): string => {
    const key = outlineDescriptionKey(description);
    if (urlByKey.has(key)) return urlByKey.get(key)!;
    if (orphanIdx < orphanUrls.length) return orphanUrls[orphanIdx++];
    return description;
  };

  let stripped = content.replace(/\[ILLUSTRATION:\s*[^\]]+\]/gi, "");
  stripped = stripped.replace(/\n{3,}/g, "\n\n");

  const { content: withMarkers } = injectOutlineIllustrationSlots(stripped, slots);
  let updated = withMarkers;
  let realigned = 0;
  let pending = 0;

  updated = updated.replace(/\[ILLUSTRATION:\s*([^\]]+)\]/gi, (full, inner: string) => {
    const desc = inner.trim();
    if (desc.startsWith("/") || desc.startsWith("http")) return full;
    const resolved = resolvePayload(desc);
    if (resolved.startsWith("/") || resolved.startsWith("http")) {
      realigned++;
      return `[ILLUSTRATION: ${resolved}]`;
    }
    pending++;
    return `[ILLUSTRATION: ${desc}]`;
  });

  return { content: updated.replace(/\n{3,}/g, "\n\n"), realigned, pending };
}
