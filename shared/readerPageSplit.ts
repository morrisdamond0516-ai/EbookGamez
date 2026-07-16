/**
 * Fixed-layout reader pagination — shared by book-reader, flipbook-preview, and quality gates.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BOOK-TYPE LAYOUT FORMULAS (digital flipbook 500×680 — NOT reflowable EPUB)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chrome (must match book-reader.tsx):
 *   padding 16 / 20 / 28, running title ~26px, gap under title 20px, safety buffer.
 *   NET usable height → MAX_VISUAL_LINES (recalculated — older Replit caps packed
 *   more lines than the CSS box can hold → runoff at the bottom edge).
 *
 * Novel / fiction (Replit heritage, still correct for story books):
 *   - Each resolved URL illustration gets its OWN full page (prevents clipping).
 *   - Flush leftover body text before that art page; half-full prior pages are OK.
 *
 * Schoolbook / textbook (student take-home — different formula):
 *   - LARGE INLINE figures (kid-readable diagrams) share the page with lesson text.
 *   - Pack to within ~2 lines of the foot (densify). Never stretch CSS gaps.
 *   - Never orphan Objectives / Example / Practice headers.
 *   - Wrap sentences at the page edge; prefer ≥2 lines on the closing page chunk.
 *
 * Activity / workbook:
 *   - Same packing as schoolbook, slightly tighter max lines (ruled lines + puzzles).
 *
 * Why one formula fails across genres: full-bleed novel art on a schoolbook page
 * leaves empty "caption islands"; packing schoolbook text under novel-size art
 * clips. Always pass `smallIllustrations` / `maxLines` from genre detection.
 */
import {
  paginationLeaderNeedsFollower,
  PAGINATION_MIN_FOLLOWER_LINES,
  requiredFollowerItemsForLeader,
  collectFollowerLineIndices,
  pageEndsWithOrphanLeader,
} from "./readerPagination";
import {
  isAsciiPuzzleLine,
  isRuledWritingLine,
  parseLabeledWritingLine,
  shouldRenderAsWorksheetLine,
} from "./activityBookContent";
import { isInstructionalSectionHeader } from "./educationalBookQuality";

export const PAGE_WIDTH_PX = 500;
export const PAGE_HEIGHT_PX = 680;
export const CONTENT_PAD_TOP = 16;
export const CONTENT_PAD_SIDE = 20;
export const CONTENT_PAD_BOTTOM = 28;
export const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - CONTENT_PAD_SIDE * 2;
export const CONTENT_HEIGHT_PX = PAGE_HEIGHT_PX - CONTENT_PAD_TOP - CONTENT_PAD_BOTTOM;
/** Running chapter title strip in book-reader. */
export const RUNNING_TITLE_PX = 26;
/** Matches the empty `<div style={{ height: 20 }} />` under the running title. */
export const RUNNING_TITLE_GAP_PX = 20;
/**
 * Residual safety for font variance vs Libre Baskerville. Keep small —
 * oversized safety was packing to “94% estimate / ~75% visual.”
 */
export const LAYOUT_SAFE_PX = 8;
export const NET_CONTENT_PX =
  CONTENT_HEIGHT_PX - RUNNING_TITLE_PX - RUNNING_TITLE_GAP_PX - LAYOUT_SAFE_PX;
export const BODY_FONT_PX = 12.5;
export const BODY_LINE_HEIGHT = 1.65;
export const PX_PER_LINE = BODY_FONT_PX * BODY_LINE_HEIGHT;
/**
 * Cap from NET_CONTENT_PX / PX_PER_LINE (≈28.2). Pack close to the foot so
 * schoolbook pages end ~2 lines above the bottom, not floating at ~75%.
 */
export const MAX_VISUAL_LINES = 28;
export const WORKBOOK_MAX_VISUAL_LINES = 27;
/**
 * Libre Baskerville @ 12.5px average advance (justified). Slightly under 7.0
 * so we don't under-fill the page; still safer than the old 6.5 runoff.
 */
export const PX_PER_CHAR_REGULAR = 6.6;
export const PX_PER_CHAR_WIDE = 7.6;
export const CONTENT_PX_BODY = 460;
export const CONTENT_PX_INDENTED = 440;
export const CONTENT_PX_TEXTINDENT = 20;
export const CHARS_PER_LINE_TABLE = 60;
export const HEADER_PX_PER_LINE = 16 * 1.25;
export const HEADER_MARGIN_PX = 12 + 8;
export const HEADER_CHARS_PER_LINE = 42;
export const HEADER_LINE_COST = HEADER_PX_PER_LINE / PX_PER_LINE;
export const HEADER_MARGIN_COST = HEADER_MARGIN_PX / PX_PER_LINE;
/** Fiction full-bleed figure budget (~one page). */
export const ILLUST_LINES_STANDARD = 22;
/**
 * Schoolbook/workbook figure budget (~21 lines ≈ 417px).
 * Kids need to see labels and details — not postage-stamp diagrams. Still leaves
 * room for a heading + a few lesson lines on the same page; densify fills the rest.
 * Do NOT use CSS space-between to fake fill — that wrecks bullet / figure rhythm.
 */
export const ILLUST_LINES_INLINE = 21;
export const ILLUST_MARGIN_PX = 16;
export const ILLUST_MAX_PX_INLINE = Math.floor(ILLUST_LINES_INLINE * PX_PER_LINE - ILLUST_MARGIN_PX);
/** Pipe caption under a figure (~1.2 visual lines at 10.5px italic). */
export const ILLUST_CAPTION_LINES = 1.2;
export const BLANK_DIV_HEIGHT_PX = 8;
export const CONT_PREFIX = "\x01CONT\x01";

/** Below this visual-line fill, a page is "underfilled" and should merge when possible. */
export const MIN_PAGE_FILL_LINES = 12;
/** Below this word count (non-illustration text), a page looks empty to a human. */
export const MIN_PAGE_TEXT_WORDS = 40;
/**
 * Densify packs all the way to ~2 lines above the foot (not 2.5 on a short
 * budget — that left a visible empty band).
 */
export const SCHOOLBOOK_BOTTOM_SLACK_LINES = 2;
export const SCHOOLBOOK_BOTTOM_SLACK_PX = Math.round(SCHOOLBOOK_BOTTOM_SLACK_LINES * PX_PER_LINE);
/** @deprecated use SCHOOLBOOK_BOTTOM_SLACK_LINES — kept for older call sites */
export const SCHOOLBOOK_TARGET_FILL = 1 - SCHOOLBOOK_BOTTOM_SLACK_LINES / MAX_VISUAL_LINES;
/** When breaking a paragraph across pages, leave at least this many visual lines behind. */
export const MIN_TRAILING_LINES_ON_SPLIT = 2;

export type SplitPagesOptions = {
  smallIllustrations?: boolean;
  maxLines?: number;
  /** Merge underfilled pages after the initial split (default true). */
  mergeUnderfilled?: boolean;
};

export function estimateVisualLines(line: string, smallIllustrations = false): number {
  const trimmed = line.trim();
  if (trimmed === "") return BLANK_DIV_HEIGHT_PX / PX_PER_LINE;

  if (isAsciiPuzzleLine(trimmed) || trimmed.startsWith("\x01PUZZLE\x01")) {
    return Math.max(1, Math.ceil(trimmed.replace("\x01PUZZLE\x01", "").length / 58));
  }
  if (shouldRenderAsWorksheetLine(trimmed)) {
    if (isRuledWritingLine(trimmed)) return 1.65;
    if (parseLabeledWritingLine(trimmed)) return 1.55;
    return 1.45;
  }

  const illustrationMatch =
    trimmed.match(/\[ILLUSTRATION:\s*(.+?)\]/i) ||
    trimmed.match(/\[IMAGE:\s*(.+?)\]/i) ||
    trimmed.match(/\[COMIC PANEL:\s*(.+?)\]/i);
  if (illustrationMatch) {
    const payload = illustrationMatch[1].trim();
    const pipeIdx = payload.indexOf(" | ");
    const src = (pipeIdx >= 0 ? payload.slice(0, pipeIdx) : payload).trim();
    const caption = pipeIdx >= 0 ? payload.slice(pipeIdx + 3).trim() : "";
    const isUrl = src.startsWith("http") || src.startsWith("/");
    let cost = isUrl
      ? smallIllustrations
        ? ILLUST_LINES_INLINE
        : ILLUST_LINES_STANDARD
      : 10;
    if (caption) cost += ILLUST_CAPTION_LINES;
    return cost;
  }

  const headerMatch = trimmed.match(/^#{2,}\s*\**\s*(.+?)\s*\**\s*$/);
  const boldOnly = trimmed.match(/^\*\*([^*]+)\*\*\s*:?\s*$/);
  if (headerMatch || boldOnly) {
    const title = (headerMatch?.[1] || boldOnly?.[1] || "").replace(/\*+/g, "").trim();
    // Schoolbook instructional chrome (Objectives / Example / Practice) is a padded callout ~3.2 lines.
    if (isInstructionalSectionHeader(trimmed) || isInstructionalSectionHeader(title)) {
      return 3.2;
    }
    const headerWrappedLines = Math.ceil(title.length / HEADER_CHARS_PER_LINE) || 1;
    return headerWrappedLines * HEADER_LINE_COST + HEADER_MARGIN_COST;
  }

  const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("\u2022 ");
  const isTableRow = trimmed.startsWith("|");
  const isDialogue = trimmed.startsWith('"') || trimmed.startsWith("\u201c") || trimmed.startsWith("'");

  if (isTableRow) {
    return Math.ceil(trimmed.length / CHARS_PER_LINE_TABLE) + 0.2;
  }

  const underscores = (trimmed.match(/_/g) || []).length;
  const normalChars = trimmed.length - underscores;
  const estimatedPx = underscores * PX_PER_CHAR_WIDE + normalChars * PX_PER_CHAR_REGULAR;

  let wrapped: number;
  if (isBullet || isDialogue) {
    wrapped = Math.ceil(estimatedPx / CONTENT_PX_INDENTED);
  } else {
    wrapped = Math.ceil((estimatedPx + CONTENT_PX_TEXTINDENT) / CONTENT_PX_BODY);
  }
  return Math.max(1, wrapped) + 0.25;
}

export function pageVisualLines(page: string[], smallIllustrations: boolean): number {
  return page.reduce((sum, l) => {
    const t = l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length) : l;
    return sum + estimateVisualLines(t, smallIllustrations);
  }, 0);
}

export function pageTextWordCount(page: string[]): number {
  return page
    .filter((l) => {
      const t = (l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length) : l).trim();
      return t && !/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):/i.test(t);
    })
    .join(" ")
    .replace(/[#*_`]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function pageHasIllustration(page: string[]): boolean {
  return page.some((l) => /\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):/i.test(l));
}

export function isUnderfilledPage(
  page: string[],
  smallIllustrations: boolean,
  maxLines: number,
): boolean {
  const nonEmpty = page.filter((l) => {
    const t = (l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length) : l).trim();
    return t !== "";
  });
  if (nonEmpty.length === 0) return true;

  const words = pageTextWordCount(page);
  const lines = pageVisualLines(page, smallIllustrations);
  const onlyIllust =
    nonEmpty.length > 0 &&
    nonEmpty.every((l) => /\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):/i.test(l));

  // Illustration-only pages are intentional in novel full-bleed mode.
  if (onlyIllust && !smallIllustrations) return false;

  // Schoolbook: postage-stamp figure-only pages look empty, but kid-size diagrams
  // (~ILLUST_LINES_INLINE) that nearly fill the page are an intentional layout.
  if (smallIllustrations && onlyIllust) {
    return lines < maxLines * 0.65;
  }
  if (words > 0 && words < MIN_PAGE_TEXT_WORDS && lines < MIN_PAGE_FILL_LINES) return true;
  if (words > 0 && words <= 30 && lines < maxLines * 0.5) return true;
  // Figure + thin leftovers look empty; pure text pages can legitimately be shorter at chapter end.
  if (smallIllustrations && pageHasIllustration(page) && lines < maxLines * 0.55 && words < MIN_PAGE_TEXT_WORDS) {
    return true;
  }
  return false;
}

function splitParagraphAtSentences(text: string, maxLines: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!sentences || sentences.length <= 1) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const candidate = current ? `${current}${s}` : s;
    if (estimateVisualLines(candidate.trim()) > maxLines && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

function splitParagraphForPageBreak(
  text: string,
  remainingLines: number,
): { firstPart: string; secondPart: string } | null {
  if (remainingLines < MIN_TRAILING_LINES_ON_SPLIT) return null;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!sentences || sentences.length <= 1) return null;
  let first = "";
  for (let i = 0; i < sentences.length - 1; i++) {
    const candidate = first ? `${first}${sentences[i]}` : sentences[i];
    if (estimateVisualLines(candidate.trim()) <= remainingLines) {
      first = candidate;
    } else break;
  }
  if (!first.trim()) return null;
  const second = text.slice(first.length).trim();
  if (!second) return null;
  const firstLines = estimateVisualLines(first.trim());
  if (firstLines < MIN_TRAILING_LINES_ON_SPLIT) return null;
  if (estimateVisualLines(second) < 1.2) return null;
  return { firstPart: first.trim(), secondPart: second };
}

/**
 * Merge underfilled pages into neighbors when the combined height fits.
 * Never create an orphaned section header (Example / Objectives / Practice alone).
 */
export function mergeUnderfilledPages(
  pages: string[][],
  smallIllustrations: boolean,
  maxLines: number,
): string[][] {
  if (pages.length <= 1) return pages;
  const out: string[][] = pages.map((p) => [...p]);
  let i = 0;
  let guard = 0;
  const maxGuard = Math.max(out.length * 8, 64);
  while (i < out.length && guard < maxGuard) {
    guard++;
    const page = out[i];
    if (!isUnderfilledPage(page, smallIllustrations, maxLines)) {
      i++;
      continue;
    }
    // Prefer merging forward (keep reading order denser).
    if (i + 1 < out.length) {
      const combined = [...page, ...out[i + 1]];
      if (pageVisualLines(combined, smallIllustrations) <= maxLines + 0.5) {
        out[i] = combined;
        out.splice(i + 1, 1);
        continue;
      }
    }
    // Else merge backward — but never leave a section leader stranded at the bottom.
    if (i > 0) {
      const combined = [...out[i - 1], ...page];
      const wouldOrphanLeader =
        pageEndsWithOrphanLeader(out[i - 1]) ||
        (pageEndsWithOrphanLeader(combined) &&
          !page.some((l) => {
            const t = l.trim();
            return t && !paginationLeaderNeedsFollower(t);
          }));
      const thinIsLeaderOnly = page
        .map((l) => l.trim())
        .filter(Boolean)
        .every((t) => paginationLeaderNeedsFollower(t));
      if (
        !thinIsLeaderOnly &&
        !wouldOrphanLeader &&
        pageVisualLines(combined, smallIllustrations) <= maxLines + 0.5
      ) {
        out[i - 1] = combined;
        out.splice(i, 1);
        i = Math.max(0, i - 1);
        continue;
      }
    }
    // Cannot merge whole page — pull following lines until fill or overflow.
    if (i + 1 < out.length) {
      const next = out[i + 1];
      while (next.length > 0) {
        const line = next[0];
        const trial = [...out[i], line];
        if (pageVisualLines(trial, smallIllustrations) > maxLines) break;
        out[i].push(next.shift()!);
      }
      if (next.length === 0) out.splice(i + 1, 1);
      if (pageEndsWithOrphanLeader(out[i]) && i + 1 < out.length) {
        const next2 = out[i + 1];
        while (next2.length > 0 && pageEndsWithOrphanLeader(out[i])) {
          const line = next2[0];
          const trial = [...out[i], line];
          if (pageVisualLines(trial, smallIllustrations) > maxLines) break;
          out[i].push(next2.shift()!);
        }
        if (next2.length === 0) out.splice(i + 1, 1);
      }
      if (!isUnderfilledPage(out[i], smallIllustrations, maxLines)) {
        i++;
        continue;
      }
    }
    i++;
  }
  return out.filter((p) =>
    p.some((l) => {
      const t = (l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length) : l).trim();
      return t !== "";
    }),
  );
}

/**
 * Schoolbook densify — pack each page to professional type-page depth
 * (maxLines − ~2.5 lines). Finite passes only (no unbounded continue loops).
 */
export function densifySchoolbookPages(
  pages: string[][],
  smallIllustrations: boolean,
  maxLines: number,
): string[][] {
  if (!smallIllustrations || pages.length <= 1) return pages;
  const out = pages.map((p) => [...p]);
  const target = Math.max(maxLines - SCHOOLBOOK_BOTTOM_SLACK_LINES, maxLines * 0.9);
  const maxPasses = 3;
  for (let pass = 0; pass < maxPasses; pass++) {
    let movedAny = false;
    for (let i = 0; i < out.length - 1; i++) {
      let pulls = 0;
      while (pulls < 24) {
        pulls++;
        const fill = pageVisualLines(out[i], smallIllustrations);
        if (fill >= target) break;
        const next = out[i + 1];
        if (!next || next.length === 0) {
          if (next && next.length === 0) out.splice(i + 1, 1);
          break;
        }
        while (next.length > 0 && !next[0].trim()) {
          next.shift();
          movedAny = true;
        }
        if (next.length === 0) {
          out.splice(i + 1, 1);
          movedAny = true;
          break;
        }
        const nextLine = next[0];
        const nextTrim = nextLine.trim();
        const nextIsIllust = /\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):/i.test(nextTrim);
        const nextCost = estimateVisualLines(nextTrim, smallIllustrations);

        if (nextIsIllust && fill + nextCost > maxLines) break;

        if (paginationLeaderNeedsFollower(nextTrim)) {
          const needItems = Math.min(Math.max(requiredFollowerItemsForLeader(next, 0), 1), 2);
          const pull: string[] = [nextLine];
          let blockCost = nextCost;
          let k = 1;
          while (k < next.length && pull.filter((l) => l.trim()).length < needItems + 1) {
            const cand = next[k];
            const c = estimateVisualLines(cand.trim(), smallIllustrations);
            if (fill + blockCost + c > maxLines) break;
            pull.push(cand);
            blockCost += c;
            k++;
          }
          const substantive = pull.filter((l) => {
            const t = l.trim();
            return t && !paginationLeaderNeedsFollower(t);
          });
          if (substantive.length === 0 || fill + blockCost > maxLines) break;
          out[i].push(...pull);
          next.splice(0, pull.length);
          movedAny = true;
          if (next.length === 0) out.splice(i + 1, 1);
          continue;
        }

        if (fill + nextCost > maxLines) {
          if (
            !nextIsIllust &&
            nextTrim &&
            !nextTrim.startsWith("#") &&
            maxLines - fill >= MIN_TRAILING_LINES_ON_SPLIT
          ) {
            const split = splitParagraphForPageBreak(nextTrim, maxLines - fill);
            if (split && split.firstPart !== nextTrim) {
              out[i].push(split.firstPart);
              next[0] = CONT_PREFIX + split.secondPart;
              movedAny = true;
              continue;
            }
          }
          break;
        }

        out[i].push(next.shift()!);
        movedAny = true;
        if (next.length === 0) out.splice(i + 1, 1);
      }
    }
    if (!movedAny) break;
  }
  return out.filter((p) =>
    p.some((l) => {
      const t = (l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length) : l).trim();
      return t !== "";
    }),
  );
}

export function splitIntoPages(
  text: string,
  reservedLines = 0,
  options: SplitPagesOptions = {},
): string[][] {
  const rawLines = text.split("\n");
  const lines: string[] = [];
  let prevWasEmpty = false;
  for (const l of rawLines) {
    const isEmpty = l.trim() === "";
    if (isEmpty && prevWasEmpty) continue;
    lines.push(l);
    prevWasEmpty = isEmpty;
  }

  const {
    smallIllustrations = false,
    maxLines = MAX_VISUAL_LINES,
    mergeUnderfilled = true,
  } = options;

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let visualCount = 0;
  let isFirstPage = true;

  const est = (s: string) => estimateVisualLines(s, smallIllustrations);

  const pullTrailingLeadersBeforeFlush = () => {
    while (currentPage.length > 1) {
      const lastTrimmed = currentPage[currentPage.length - 1].trim();
      if (!lastTrimmed) {
        currentPage.pop();
        continue;
      }
      if (!paginationLeaderNeedsFollower(lastTrimmed)) break;
      const leader = currentPage.pop()!;
      visualCount -= est(leader.trim());
      pages.push([...currentPage]);
      currentPage = [leader];
      visualCount = est(leader.trim());
      isFirstPage = false;
    }
  };

  const flushPage = () => {
    pullTrailingLeadersBeforeFlush();
    if (currentPage.length === 0) return;
    pages.push([...currentPage]);
    currentPage = [];
    visualCount = 0;
    isFirstPage = false;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();
    if (trimmedLine === "" && currentPage.length === 0) continue;
    const cost = est(trimmedLine);
    const isIllustration =
      /\[ILLUSTRATION:/i.test(trimmedLine) ||
      /\[IMAGE:/i.test(trimmedLine) ||
      /\[COMIC PANEL:/i.test(trimmedLine);
    const isHeader = !isIllustration && trimmedLine.startsWith("##");
    const isSpecialLine = isIllustration || isHeader || trimmedLine.startsWith(CONT_PREFIX);
    const pageMax = isFirstPage ? maxLines - reservedLines : maxLines;

    if (paginationLeaderNeedsFollower(trimmedLine) && currentPage.length > 0) {
      const needItems = requiredFollowerItemsForLeader(lines, lineIndex);
      const followerIdxs = collectFollowerLineIndices(lines, lineIndex, Math.max(needItems, 1));
      let followerCost = PAGINATION_MIN_FOLLOWER_LINES;
      if (followerIdxs.length > 0) {
        followerCost = followerIdxs.reduce((sum, idx) => sum + est(lines[idx].trim()), 0);
        followerCost = Math.max(followerCost, needItems * 1.5);
      }
      if (pageMax - visualCount < cost + followerCost) flushPage();
    }

    const pageHasContinuation = currentPage.some((l) => l.startsWith(CONT_PREFIX));
    const isUrlIllustration =
      isIllustration &&
      (trimmedLine.includes("/uploads/") ||
        trimmedLine.includes("/objstore/") ||
        trimmedLine.includes("http"));
    const effectiveCost = cost;

    // Schoolbooks: flush before a figure ONLY when it will not fit on this page.
    // (Do NOT flush at 75% — that creates intentional half/three-quarter leftover pages.)
    // Novels: always give URL art its own page (Replit rule).
    if (isIllustration && currentPage.length > 0) {
      if (isUrlIllustration && smallIllustrations) {
        if (visualCount + effectiveCost > pageMax) flushPage();
      } else if (isUrlIllustration && !smallIllustrations) {
        flushPage();
      } else if (
        !isUrlIllustration &&
        !smallIllustrations &&
        (visualCount > pageMax * 0.5 || pageHasContinuation)
      ) {
        flushPage();
      }
    }

    if (cost > maxLines) {
      if (currentPage.length > 0) flushPage();
      const chunks = splitParagraphAtSentences(trimmedLine, maxLines);
      for (let ci = 0; ci < chunks.length - 1; ci++) {
        pages.push([ci === 0 ? chunks[ci] : CONT_PREFIX + chunks[ci]]);
      }
      const lastChunkRaw = chunks[chunks.length - 1];
      currentPage = [chunks.length === 1 ? lastChunkRaw : CONT_PREFIX + lastChunkRaw];
      visualCount = est(lastChunkRaw);
      isFirstPage = false;
      continue;
    }

    const isDecorativeLine = cost <= 1.5 && !trimmedLine.match(/[a-zA-Z0-9_]/);

    if (
      visualCount + effectiveCost > pageMax &&
      currentPage.length > 0 &&
      (!isDecorativeLine || visualCount > pageMax)
    ) {
      const remainingLines = pageMax - visualCount;
      if (!isSpecialLine && !isDecorativeLine && trimmedLine !== "" && remainingLines >= MIN_TRAILING_LINES_ON_SPLIT) {
        const split = splitParagraphForPageBreak(trimmedLine, remainingLines);
        if (split) {
          currentPage.push(split.firstPart);
          flushPage();
          currentPage = [CONT_PREFIX + split.secondPart];
          visualCount = est(split.secondPart);
          isFirstPage = false;
          continue;
        }
      }
      flushPage();
    }

    if (trimmedLine === "" && currentPage.length === 0) continue;
    currentPage.push(trimmedLine);
    visualCount += effectiveCost;

    // Novel rule: URL illustration closes the page immediately.
    if (isUrlIllustration && !smallIllustrations) {
      pages.push([...currentPage]);
      currentPage = [];
      visualCount = 0;
      isFirstPage = false;
    }
  }

  if (currentPage.length > 0) {
    const hasContent = currentPage.some((l) => {
      const t = l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length).trim() : l.trim();
      return t !== "";
    });
    if (hasContent) pages.push(currentPage);
  }

  const repaired = repairOrphanSectionHeaders(pages, smallIllustrations, maxLines);
  const merged = mergeUnderfilled
    ? mergeUnderfilledPages(repaired, smallIllustrations, maxLines)
    : repaired;
  const densified =
    mergeUnderfilled && smallIllustrations
      ? densifySchoolbookPages(merged, smallIllustrations, maxLines)
      : merged;
  return reflowOverflowPages(densified, smallIllustrations, maxLines);
}

/** Push overflow lines from an overfull page onto the next page (preserve order). */
function reflowOverflowPages(
  pages: string[][],
  smallIllustrations: boolean,
  maxLines: number,
): string[][] {
  const out = pages.map((p) => [...p]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < out.length; i++) {
      let guard = 0;
      while (
        pageVisualLines(out[i], smallIllustrations) > maxLines + 0.05 &&
        out[i].length > 1 &&
        guard < 30
      ) {
        guard++;
        const moved = out[i].pop()!;
        while (out[i].length > 0 && !out[i][out[i].length - 1].trim()) out[i].pop();
        if (i + 1 >= out.length) out.push([]);
        out[i + 1].unshift(moved);
      }
      guard = 0;
      while (pageEndsWithOrphanLeader(out[i]) && out[i].length > 0 && i + 1 < out.length && guard < 8) {
        guard++;
        const leader = out[i].pop()!;
        while (out[i].length > 0 && !out[i][out[i].length - 1].trim()) out[i].pop();
        out[i + 1].unshift(leader);
      }
    }
  }
  return out.filter((p) => p.some((l) => l.trim()));
}

/** Move pages that end with orphan leaders forward onto the next page with their followers. */
function repairOrphanSectionHeaders(
  pages: string[][],
  smallIllustrations: boolean,
  maxLines: number,
): string[][] {
  if (pages.length <= 1) return pages;
  const out = pages.map((p) => [...p]);
  for (let i = 0; i < out.length - 1; i++) {
    let pulls = 0;
    while (pageEndsWithOrphanLeader(out[i]) && out[i].length > 0 && pulls < 20) {
      pulls++;
      const leader = out[i].pop()!;
      while (out[i].length > 0 && !out[i][out[i].length - 1].trim()) out[i].pop();
      out[i + 1] = [leader, ...out[i + 1]];
    }
    if (out[i].length === 0) {
      out.splice(i, 1);
      i--;
    }
  }
  return reflowOverflowPages(
    out.filter((p) => p.some((l) => l.trim())),
    smallIllustrations,
    maxLines,
  );
}

export type SparsePageReport = {
  totalPages: number;
  underfilledPages: number;
  samples: { pageIndex: number; words: number; lines: number; preview: string }[];
  issues: string[];
};

/** Quality-gate scan: simulate reader pages and flag underfilled ones. */
export function scanUnderfilledReaderPages(
  content: string,
  options: { smallIllustrations?: boolean; maxLines?: number; chapterLimit?: number } = {},
): SparsePageReport {
  const smallIllustrations = options.smallIllustrations ?? true;
  const maxLines = options.maxLines ?? MAX_VISUAL_LINES;
  const chapterRe = /^##\s*\**\s*Chapter\s+\d+/gim;
  const headers = [...content.matchAll(chapterRe)];
  const samples: SparsePageReport["samples"] = [];
  let totalPages = 0;
  let underfilledPages = 0;
  const limit = options.chapterLimit ?? (headers.length || 1);

  const chapters =
    headers.length > 0
      ? headers.slice(0, limit).map((h, i) => {
          const start = h.index! + h[0].length;
          const end = i + 1 < headers.length ? headers[i + 1].index! : content.length;
          return content.slice(start, end);
        })
      : [content];

  for (const ch of chapters) {
    const pages = splitIntoPages(ch, 0, {
      smallIllustrations,
      maxLines,
      mergeUnderfilled: true,
    });
    totalPages += pages.length;
    for (let pi = 0; pi < pages.length; pi++) {
      // Last page of a chapter may legitimately be short (trade practice).
      if (pi === pages.length - 1) continue;
      if (isUnderfilledPage(pages[pi], smallIllustrations, maxLines)) {
        underfilledPages++;
        if (samples.length < 12) {
          const textLines = pages[pi]
            .map((l) => (l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length) : l).trim())
            .filter((t) => t && !/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):/i.test(t));
          samples.push({
            pageIndex: totalPages - pages.length + pi + 1,
            words: pageTextWordCount(pages[pi]),
            lines: Math.round(pageVisualLines(pages[pi], smallIllustrations) * 10) / 10,
            preview: textLines.map((t) => t.slice(0, 80)).join(" · ").slice(0, 160),
          });
        }
      }
    }
  }

  const issues: string[] = [];
  if (underfilledPages > 2) {
    issues.push(
      `${underfilledPages} underfilled reader page(s) (one sentence / thin bullet pages) — add instructional text between figures or reduce illustration density so pages fill`,
    );
  }

  return { totalPages, underfilledPages, samples, issues };
}
