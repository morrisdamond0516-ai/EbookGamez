/**
 * Activity / workbook line quality — detection, normalization, and illustration caps.
 * Used by content generation, repair jobs, and the flipbook reader.
 */

export const ACTIVITY_PUZZLE_LINE_ART_STYLE =
  "black and white line art only, clean puzzle outlines, print-ready activity page, no shading, no color fills, crisp maze walls or connect-the-dots paths, professional children's activity book quality";

export const ACTIVITY_BOOK_VISUAL_GENRES = [
  "activity book",
  "workbook",
  "guided journal",
  "journals",
  "planners",
] as const;

export function isActivityOrWorkbookGenre(genre: string | null | undefined): boolean {
  const g = (genre || "").toLowerCase();
  return ACTIVITY_BOOK_VISUAL_GENRES.some((k) => g.includes(k));
}

/** Planners are structured text/forms — no AI interior illustrations. */
export function isPlannerGenre(genre: string | null | undefined): boolean {
  return (genre || "").toLowerCase().includes("planner");
}

/** Guided journals may include fill-in ruled lines — not ASCII mazes. */
export function isJournalGenre(genre: string | null | undefined): boolean {
  return (genre || "").toLowerCase().includes("journal");
}

/** Activity/workbook genres that need generated puzzle or scene art. */
export function needsInteriorIllustrations(genre: string | null | undefined): boolean {
  return isActivityOrWorkbookGenre(genre) && !isPlannerGenre(genre);
}

/** Max generated illustrations per chapter (activity books need more puzzle pages). */
export function getIllustrationCapForGenre(genre: string | null | undefined): number {
  if (isPlannerGenre(genre)) return 0;
  return isActivityOrWorkbookGenre(genre) ? 12 : 2;
}

/** Block publish/storefront when puzzle art or markers are incomplete. */
export function getActivityBookPublishBlockers(
  content: string,
  genre: string | null | undefined,
): string[] {
  if (!isActivityOrWorkbookGenre(genre) || !content?.trim()) return [];

  // Planners are fill-in templates — no interior AI art, ruled lines are intentional.
  if (isPlannerGenre(genre)) return [];

  const issues: string[] = [];
  const allMarkers = [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)];
  const pendingMarkers = allMarkers.filter((m) => {
    const payload = m[1].trim();
    return !payload.startsWith("/") && !payload.startsWith("http") && !isFakeWorksheetIllustrationMarker(payload);
  }).length;
  const resolvedCount = allMarkers.filter((m) => {
    const payload = m[1].trim();
    return payload.startsWith("/") || payload.startsWith("http");
  }).length;

  // ASCII maze detection for workbooks/activity books still missing puzzle art.
  const skipAsciiScan = isJournalGenre(genre) && resolvedCount >= 10;
  if (!skipAsciiScan && (needsInteriorIllustrations(genre) || resolvedCount === 0)) {
    const asciiLines = countAsciiPuzzleLines(content);
    if (asciiLines > 0) {
      issues.push(`${asciiLines} ASCII puzzle line(s) — mazes and grids need [ILLUSTRATION:] images, not text art`);
    }
  }

  const chapterCount = (content.match(/##\s*Chapter\s+\d+/gi) || []).length;

  if (allMarkers.length === 0) {
    issues.push("Activity book has no illustration markers");
  }
  if (pendingMarkers > 0) {
    issues.push(`${pendingMarkers} pending illustration marker(s) need image generation`);
  }
  if (resolvedCount < Math.max(1, Math.min(chapterCount || 1, 3))) {
    issues.push(`Only ${resolvedCount} illustration image(s) — need puzzle/scene art per chapter`);
  }

  return issues;
}

/** Line looks like ASCII maze / grid / connect-dots drawn in plain text. */
export function isAsciiPuzzleLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 6) return false;
  const alpha = (t.match(/[a-zA-Z]/g) || []).length;
  if (alpha > 2) return false;
  const puzzleChars = (t.match(/[|+\-_#.oO●○◦·×xX*═│─┌┐└┘├┤┬┴┼\\\/]/g) || []).length;
  return puzzleChars >= Math.max(4, Math.floor(t.length * 0.35));
}

/** Fill-in-the-blank or ruled answer line (underscores dominate). */
export function isFillInBlankLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const underscores = (t.match(/_/g) || []).length;
  return underscores >= 8 && underscores / t.length >= 0.25;
}

/** Standalone ruled line for handwriting (underscores, dots, or dashes only). */
export function isRuledWritingLine(line: string): boolean {
  const t = line.trim().replace(/^[-•]\s+/, "");
  if (t.length < 5) return false;
  if (/[a-zA-Z0-9]/.test(t.replace(/[_.\-–—\s]/g, ""))) return false;
  const ruled = (t.match(/[_.\-–—]/g) || []).length;
  return ruled >= 5 && ruled / t.length >= 0.7;
}

export type LabeledWritingField = { label: string; blankChars: number };

/** "Clue: ______", "**Suspect:** ___", "1. Location: ____" */
export function parseLabeledWritingLine(line: string): LabeledWritingField | null {
  let t = line.trim().replace(/^[-•]\s+/, "");
  t = t.replace(/^\d+\.\s+/, "");
  const m = t.match(/^(\*{0,2})([^_:]{1,48}?)(\*{0,2})\s*:\s*([_.\-–—\s]{3,})\s*$/);
  if (!m) return null;
  const label = m[2].replace(/\*+/g, "").trim();
  if (!label || label.length < 2) return null;
  const blank = m[4].replace(/\s/g, "");
  return { label, blankChars: Math.max(blank.length, 12) };
}

export function hasInlineWritingBlank(line: string): boolean {
  const t = line.trim().replace(/^[-•]\s+/, "");
  return /_{3,}/.test(t) && /[a-zA-Z]/.test(t);
}

/** Evidence log, field notes, detective worksheet headers. */
export function isWorksheetSectionHeader(line: string): boolean {
  const t = line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*+/g, "")
    .toLowerCase();
  return /evidence\s*log|field\s*notes?|detective\s*log|case\s*notes?|suspect\s*list|answer\s*sheet|fill\s*this\s*in/.test(t);
}

export function shouldRenderAsWorksheetLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return (
    isRuledWritingLine(t) ||
    isFillInBlankLine(t) ||
    hasInlineWritingBlank(t) ||
    parseLabeledWritingLine(t) !== null
  );
}

/** Decorative divider that should stay on one visual row. */
export function isDecorativeRuleLine(line: string): boolean {
  const t = line.trim();
  return /^[-–—_*]{3,}$/.test(t) || /^\* \* \*$/.test(t);
}

export type AsciiPuzzleBlock = { start: number; end: number; lines: string[] };

export function detectAsciiPuzzleBlocks(content: string): AsciiPuzzleBlock[] {
  const lines = content.split("\n");
  const blocks: AsciiPuzzleBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!isAsciiPuzzleLine(lines[i])) {
      i++;
      continue;
    }
    const start = i;
    const blockLines: string[] = [];
    while (i < lines.length && isAsciiPuzzleLine(lines[i])) {
      blockLines.push(lines[i]);
      i++;
    }
    if (blockLines.length >= 1) {
      blocks.push({ start, end: i, lines: blockLines });
    }
  }
  return blocks;
}

/** Join orphaned "2." markers to the following exercise line. */
export function fixOrphanNumberedExerciseLines(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^\d+\.?\s*$/.test(t) && i + 1 < lines.length && lines[i + 1].trim()) {
      out.push(`${t.replace(/\.$/, "")}. ${lines[i + 1].trim()}`);
      i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

/** Cap runaway underscore/dash lines so fill-in fields fit one visual row in the reader. */
export function collapseLongWritingLines(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  const bullet = trimmed.match(/^([-•]\s+)/)?.[1] || "";
  const core = trimmed.slice(bullet.length);

  if (isRuledWritingLine(core) || isFillInBlankLine(core)) {
    const capped = core.replace(/[_\-.–—]+/g, (run) =>
      run.length > 16 ? "_".repeat(14) : run,
    );
    return bullet + capped;
  }

  const labeled = parseLabeledWritingLine(trimmed);
  if (labeled && labeled.blankChars > 18) {
    return trimmed.replace(/([_.\-–—\s]{3,})\s*$/, "_".repeat(14));
  }

  if (hasInlineWritingBlank(trimmed)) {
    return trimmed.replace(/_{12,}/g, "_".repeat(14));
  }

  return line;
}

/** Normalize activity/workbook markdown before pagination or repair. */
export function normalizeActivityBookContent(content: string): string {
  let text = fixOrphanNumberedExerciseLines(content);

  // "Clue:" on one line + underscores on the next → single labeled field
  const lines = text.split("\n");
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : "";
    if (/^(\*{0,2})[A-Za-z][^:]{0,40}(\*{0,2})\s*:\s*$/.test(t) && isRuledWritingLine(next)) {
      merged.push(`${t} ${next.replace(/\./g, "_")}`);
      i++;
      continue;
    }
    merged.push(collapseLongWritingLines(lines[i]));
  }
  text = merged.join("\n");

  text = text.replace(/(^[-–—_*]{3,}\s*\n){2,}/gm, "---\n");
  return text;
}

function inferPuzzleDescription(blockLines: string[], contextBefore: string): string {
  const context = contextBefore
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-4)
    .join(" ")
    .replace(/\[ILLUSTRATION:[^\]]+\]/gi, "")
    .substring(0, 280);
  const gridHint = blockLines.length > 6 ? "maze or path puzzle" : "small grid puzzle";
  return (
    context.trim() ||
    `Colorful activity book illustration for ${gridHint}, playful puzzle graphics, ${context.trim() || "engaging challenge visuals for children"}`
  );
}

/**
 * Replace ASCII puzzle grids with illustration markers so AI generates proper line art.
 * Returns { content, replacedCount }.
 */
export function convertAsciiPuzzleBlocksToIllustrationMarkers(
  content: string,
  genre: string,
): { content: string; replacedCount: number } {
  if (!isActivityOrWorkbookGenre(genre)) {
    return { content, replacedCount: 0 };
  }

  const lines = content.split("\n");
  const blocks = detectAsciiPuzzleBlocks(content);
  if (blocks.length === 0) return { content, replacedCount: 0 };

  let replacedCount = 0;
  // Process from end so indices stay valid
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const block = blocks[bi];
    const contextBefore = lines.slice(Math.max(0, block.start - 6), block.start).join("\n");
    const desc = inferPuzzleDescription(block.lines, contextBefore);
    const marker = `[ILLUSTRATION: ${desc}]`;
    lines.splice(block.start, block.end - block.start, marker);
    replacedCount++;
  }

  return { content: lines.join("\n"), replacedCount };
}

export function activityBookNeedsStructureRepair(content: string, genre: string): boolean {
  if (!isActivityOrWorkbookGenre(genre) || !content?.trim()) return false;
  if (countAsciiPuzzleLines(content) > 0) return true;
  if (detectAsciiPuzzleBlocks(content).length > 0) return true;
  return normalizeActivityBookContent(content) !== content;
}

export function countAsciiPuzzleLines(content: string): number {
  return content.split("\n").filter((l) => isAsciiPuzzleLine(l)).length;
}

export function countUnprocessedIllustrationMarkers(content: string): number {
  return [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)].filter((m) => {
    const src = m[1].trim();
    if (src.startsWith("/") || src.startsWith("http")) return false;
    if (isFakeWorksheetIllustrationMarker(src)) return false;
    return true;
  }).length;
}

/** Batch-repair sometimes wrapped worksheet lines in [ILLUSTRATION:] — not real image slots. */
export function isFakeWorksheetIllustrationMarker(inner: string): boolean {
  const payload = inner.trim().split("|")[0].trim();
  if (payload.startsWith("/") || payload.startsWith("http")) return false;
  if (/^#{1,6}\s/m.test(payload)) return true;
  if ((payload.match(/_/g) || []).length >= 4) return true;
  if (/^\d+\)\s/.test(payload)) return true;
  if (/^\d+\.\s/.test(payload) && (payload.match(/_/g) || []).length >= 4) return true;
  if (/^\*\*[^*]+:\*\*/.test(payload)) return true;
  if (/^-\s+.+_{4,}/.test(payload)) return true;
  if (/^-\s*Date:\s*_{2,}/i.test(payload)) return true;
  if (/^\*\*My (lowest|most common)/i.test(payload)) return true;
  return false;
}

export function stripFakeWorksheetIllustrationMarkers(content: string): { content: string; removed: number } {
  let removed = 0;
  const updated = content.replace(/\[ILLUSTRATION:\s*([^\]]+)\]/gi, (full, inner) => {
    if (!isFakeWorksheetIllustrationMarker(inner)) return full;
    removed++;
    return inner.trim();
  });
  return { content: updated.replace(/\n{3,}/g, "\n\n"), removed };
}

/** Remove or unwrap pending [ILLUSTRATION:] tags that are not resolved image URLs. */
export function unwrapNonImageIllustrationMarkers(content: string): { content: string; removed: number } {
  let removed = 0;
  const updated = content.replace(/\[ILLUSTRATION:\s*([^\]]+)\]/gi, (full, inner) => {
    const payload = inner.trim();
    if (payload.startsWith("/") || payload.startsWith("http")) return full;
    removed++;
    return payload;
  });
  return { content: updated.replace(/\n{3,}/g, "\n\n"), removed };
}

export function countResolvedIllustrationMarkers(content: string): number {
  return (content.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
}

/** Chapters with zero resolved interior illustration URLs. */
export function countChaptersWithoutResolvedIllustrations(content: string): number {
  const chapters = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  let zero = 0;
  for (let i = 0; i < chapters.length; i++) {
    const start = chapters[i].index!;
    const end = i + 1 < chapters.length ? chapters[i + 1].index! : content.length;
    const ch = content.slice(start, end);
    const resolved = (ch.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    if (resolved === 0) zero++;
  }
  return zero;
}

/** Coloring book finished on Replit — page markers and/or PDF, not local disk only. */
export function draftColoringBookContentComplete(
  content: string | null | undefined,
  pdfUrl?: string | null,
): boolean {
  if (!content?.trim()) return false;
  const pageMarkers = (content.match(/\*\*Page\s+\d+:\*\*/gi) || []).length;
  if (pageMarkers >= 10) return true;
  return !!pdfUrl?.trim();
}

/**
 * Whether a finished library book should appear in the illustration queue.
 * Avoids re-flagging Replit-complete titles after ASCII repair added text-only markers.
 */
export function draftNeedsIllustrationQueueEntry(
  content: string,
  genre: string | null | undefined,
): { needs: boolean; reason: string } {
  if (isPlannerGenre(genre)) return { needs: false, reason: "" };

  const pending = countUnprocessedIllustrationMarkers(content);
  if (pending === 0) return { needs: false, reason: "" };

  const resolved = countResolvedIllustrationMarkers(content);
  const chapterCount = (content.match(/##\s*Chapter\s+\d+/gi) || []).length;
  const ascii = countAsciiPuzzleLines(content);
  const chZero = countChaptersWithoutResolvedIllustrations(content);
  const chZeroThreshold = Math.max(1, Math.floor(chapterCount * 0.25));

  if (ascii > 0) {
    return { needs: true, reason: `${ascii} ASCII puzzle line(s) still need conversion to images` };
  }
  if (pending > resolved) {
    return { needs: true, reason: `${pending} illustration marker(s) need image generation (${resolved} already done)` };
  }
  if (chZero > chZeroThreshold) {
    return { needs: true, reason: `${chZero} chapter(s) have no resolved illustration images` };
  }
  if (resolved === 0) {
    return { needs: true, reason: `${pending} illustration marker(s) need image generation` };
  }

  return { needs: false, reason: "" };
}

/** Normalize lines and convert ASCII puzzle blocks before illustration quality checks. */
export function prepareActivityBookForIllustrationPipeline(
  content: string,
  genre: string | null | undefined,
): { content: string; asciiBlocksConverted: number } {
  if (!isActivityOrWorkbookGenre(genre) || !content?.trim()) {
    return { content, asciiBlocksConverted: 0 };
  }
  let normalized = normalizeActivityBookContent(content);
  if (isPlannerGenre(genre)) {
    return { content: normalized, asciiBlocksConverted: 0 };
  }
  const converted = convertAsciiPuzzleBlocksToIllustrationMarkers(normalized, genre || "");
  return { content: converted.content, asciiBlocksConverted: converted.replacedCount };
}
