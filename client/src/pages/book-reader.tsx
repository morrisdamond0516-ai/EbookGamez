import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import HTMLFlipBook from "react-pageflip";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface DraftEbook {
  id: number;
  title: string;
  genre: string;
  topic: string;
  description: string | null;
  content: string;
  coverUrl: string | null;
  status: string;
}

interface Chapter {
  number: number;
  title: string;
  content: string;
}

const GENRE_COLORS: Record<string, { spine: string; coverBg: string; coverText: string; accent: string }> = {
  "Romance":           { spine: "#6b1d3a", coverBg: "#4a1528", coverText: "#f4c2d0", accent: "#e8446a" },
  "Horror":            { spine: "#2a0a0a", coverBg: "#1a0808", coverText: "#d4a0a0", accent: "#dc2626" },
  "Science Fiction":   { spine: "#0a2540", coverBg: "#081c30", coverText: "#a0d4e8", accent: "#22d3ee" },
  "Fantasy":           { spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#f59e0b" },
  "Mystery":           { spine: "#1a1a3a", coverBg: "#121230", coverText: "#b0b0e0", accent: "#818cf8" },
  "Thriller":          { spine: "#1a1028", coverBg: "#140c20", coverText: "#c0a8e0", accent: "#a78bfa" },
  "Historical Fiction":{ spine: "#3a2010", coverBg: "#2a1808", coverText: "#e0c8a0", accent: "#ea580c" },
  "Literary Fiction":  { spine: "#2a2520", coverBg: "#1e1a18", coverText: "#c8c0b8", accent: "#a8a29e" },
  "Self-Help":         { spine: "#0a3020", coverBg: "#082518", coverText: "#a0e0c0", accent: "#34d399" },
  "Psychology":        { spine: "#2a1840", coverBg: "#1e1030", coverText: "#c0a8e8", accent: "#a78bfa" },
  "Business & Finance":{ spine: "#0a2040", coverBg: "#081830", coverText: "#a0c8e8", accent: "#60a5fa" },
  "Health & Wellness": { spine: "#0a2a28", coverBg: "#082020", coverText: "#a0e0d8", accent: "#2dd4bf" },
  "Spirituality":      { spine: "#2a1838", coverBg: "#1e1028", coverText: "#d0a8f0", accent: "#c084fc" },
  "Productivity":      { spine: "#1a2a10", coverBg: "#142008", coverText: "#c0e0a0", accent: "#84cc16" },
  "Classic Literature":{ spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#d4a853" },
  "Classic Horror":    { spine: "#2a0a0a", coverBg: "#1a0808", coverText: "#d4a0a0", accent: "#dc2626" },
  "Classic Science Fiction": { spine: "#0a2540", coverBg: "#081c30", coverText: "#a0d4e8", accent: "#22d3ee" },
  "Classic Mystery":   { spine: "#1a1a3a", coverBg: "#121230", coverText: "#b0b0e0", accent: "#818cf8" },
  "Classic Fantasy":   { spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#f59e0b" },
  "Classic Adventure": { spine: "#0a3020", coverBg: "#082518", coverText: "#a0e0c0", accent: "#34d399" },
  "Classic Romance":   { spine: "#6b1d3a", coverBg: "#4a1528", coverText: "#f4c2d0", accent: "#e8446a" },
  "Classic Philosophy":{ spine: "#2a2520", coverBg: "#1e1a18", coverText: "#c8c0b8", accent: "#a8a29e" },
  "Classic Epic":      { spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#ea580c" },
  "Classic Drama":     { spine: "#2a1838", coverBg: "#1e1028", coverText: "#d0a8f0", accent: "#c084fc" },
};

const DEFAULT_COLORS = { spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#f59e0b" };

function getGenreColors(genre: string) {
  return GENRE_COLORS[genre] || DEFAULT_COLORS;
}

const PAGE_BG = "#faf6ed";
const PAGE_TEXT = "#000000";
const PAGE_ACCENT = "#4a3a28";
const PAGE_HEADING = "#000000";

function parseChapters(content: string): Chapter[] {
  const chapters: Chapter[] = [];
  const lines = content.split("\n");
  let currentChapter: Chapter | null = null;
  let buffer: string[] = [];

  const hasChapterHeadings = lines.some(l => l.trim().match(/^#{1,2}\s*\**\s*Chapter\s+\d+/i));

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "---") continue;

    let chapterMatch = trimmed.match(/^#{1,2}\s*\**\s*(Chapter\s+\d+\s*[:—–\-].+?)\s*\**\s*$/i) ||
                       trimmed.match(/^#{1,2}\s*\**\s*(Chapter\s+\d+)\s*\**\s*$/i);
    if (!chapterMatch && !hasChapterHeadings) {
      chapterMatch = trimmed.match(/^#{1,2}\s*\**\s*(Part\s+\d+\s*[:—–\-].+?)\s*\**\s*$/i) ||
                     trimmed.match(/^#{1,2}\s*\**\s*(Part\s+\d+)\s*\**\s*$/i);
    }

    if (chapterMatch) {
      if (currentChapter) {
        currentChapter.content = buffer.join("\n").trim();
        chapters.push(currentChapter);
      }
      const title = chapterMatch[1].replace(/\*+/g, "").trim();
      currentChapter = { number: chapters.length + 1, title, content: "" };
      buffer = [];
      continue;
    }

    const mainTitleMatch = trimmed.match(/^#\s*\**\s*(.+?)\s*\**\s*$/);
    if (mainTitleMatch && chapters.length === 0 && !currentChapter && buffer.length < 3) {
      continue;
    }

    buffer.push(line);
  }

  if (currentChapter) {
    currentChapter.content = buffer.join("\n").trim();
    chapters.push(currentChapter);
  } else if (buffer.length > 0) {
    chapters.push({ number: 1, title: "Chapter 1", content: buffer.join("\n").trim() });
  }

  return chapters;
}

// Layout constants — derived from HTMLFlipBook props and inline styles.
// Update these if you change the flipbook dimensions or content padding.
// HTMLFlipBook:  width={500}  height={680}
const PAGE_WIDTH_PX  = 500;
const PAGE_HEIGHT_PX = 680;

// Content page wrapper:  padding="16px 20px 28px"  (top | sides | bottom)
const CONTENT_PAD_TOP    = 16;
const CONTENT_PAD_SIDE   = 20;
const CONTENT_PAD_BOTTOM = 28;
const CONTENT_WIDTH_PX   = PAGE_WIDTH_PX  - CONTENT_PAD_SIDE * 2;       // 460 px
const CONTENT_HEIGHT_PX  = PAGE_HEIGHT_PX - CONTENT_PAD_TOP - CONTENT_PAD_BOTTOM; // 636 px

// Chapter running-title strip (rendered on every content page):
//   fontSize:10  fontFamily:'Cinzel'  marginBottom:12
//   Cinzel cap-height at 10 px ≈ 13 px  →  13 + 12 = 25 px  (use 26 to be safe)
const RUNNING_TITLE_PX = 26;

// Safety margin: absorbs sub-pixel font rendering differences across browsers/screens.
const LAYOUT_SAFE_PX = 20;

// Net usable vertical pixels for body content per page.
const NET_CONTENT_PX = CONTENT_HEIGHT_PX - RUNNING_TITLE_PX - LAYOUT_SAFE_PX; // 590 px

// Body text:  fontSize:12.5  lineHeight:1.65  (Libre Baskerville)
const BODY_FONT_PX       = 12.5;
const BODY_LINE_HEIGHT   = 1.65;
const PX_PER_LINE        = BODY_FONT_PX * BODY_LINE_HEIGHT; // 20.625 px per visual line

// Max visual lines per page.
// 30 × 20.625px = 618px estimated content. Available content area (after running title)
// = 636 - 26 = 610px. The 8px overage is within the overflow:hidden clip zone and
// is invisible in practice (estimates are conservative; +0.2/element already absorbs
// marginBottoms). Going from 29→30 lets the paginator absorb one more sentence per
// page, significantly reducing dead space on chapter-ending pages.
const MAX_VISUAL_LINES          = 30;
const WORKBOOK_MAX_VISUAL_LINES = 29; // workbooks kept at 29 (illustration sizing calibrated)

// Pixel-width estimation — Libre Baskerville 12.5 px.
// `_` (7.5 px) is wider than average alphanumeric (6.5 px) — corrected separately.
// Body paragraphs have textIndent:20, so the first line is 440 px, rest are 460 px.
// Bullets/dialogue use paddingLeft on all lines, so always 440 px — no indent correction.
const PX_PER_CHAR_REGULAR   = 6.5;   // Baskerville 12.5 px average
const PX_PER_CHAR_WIDE      = 7.5;   // underscore `_` in Baskerville
const CONTENT_PX_BODY       = 460;   // full content width (textIndent correction applied separately)
const CONTENT_PX_INDENTED   = 440;   // bullets / dialogue (paddingLeft 16–20 px, all lines)
const CONTENT_PX_TEXTINDENT = 20;    // textIndent on body paragraph first lines
const CHARS_PER_LINE_TABLE  = 60;    // kept for table rows (pipe chars ≈ 7.67 px)

// Sub-header (## / ### …):  fontSize:16  Playfair Display  marginTop:12  marginBottom:8
// No explicit lineHeight → browser default for serif ≈ 1.25  → 16×1.25 = 20 px/line.
// Total per wrapped line: 20 px.  Per-element margins: 12+8=20 px.
// 1-line header:  (20 + 20) / 20.625 = 1.94 visual lines → estimator: 1×HEADER_LINE_COST + HEADER_MARGIN_COST
const HEADER_PX_PER_LINE     = 16 * 1.25;    // 20 px
const HEADER_MARGIN_PX       = 12 + 8;        // 20 px
const HEADER_CHARS_PER_LINE  = 44;            // Playfair Display 16 px ≈ 10.5 px/char → 460/10.5≈44
// visual-line cost for 1 wrapped line of header text + fixed margin overhead
const HEADER_LINE_COST   = HEADER_PX_PER_LINE / PX_PER_LINE;  // ≈ 0.970
const HEADER_MARGIN_COST = HEADER_MARGIN_PX   / PX_PER_LINE;  // ≈ 0.970

// Illustration vertical space.
// Standard: illustration gets its own full page; reserve 22 lines for flush logic.
// Workbook: illustration shares a page with exercise text; 22 lines → ~437px height, ~291px wide.
const ILLUST_LINES_STANDARD   = 22;
const ILLUST_LINES_WORKBOOK   = 22;
const ILLUST_MARGIN_PX        = 16;  // margin: "12px auto 4px" → 12 + 4 = 16 px vertical
// Standard illustrations always get their own page; maxHeight is handled by the full-page renderer.
const ILLUST_MAX_PX_WORKBOOK  = Math.floor(ILLUST_LINES_WORKBOOK  * PX_PER_LINE - ILLUST_MARGIN_PX); // 437 px
// ─── END LAYOUT CONSTANTS ────────────────────────────────────────────────────

const BLANK_DIV_HEIGHT_PX = 8; // matches renderContentLine: <div style={{ height: 8 }} />

function estimateVisualLines(line: string): number {
  const trimmed = line.trim();
  if (trimmed === "") return BLANK_DIV_HEIGHT_PX / PX_PER_LINE; // 8px ≈ 0.39 lines

  const illustrationMatch = trimmed.match(/\[ILLUSTRATION:\s*(.+?)\]/i) || trimmed.match(/\[IMAGE:\s*(.+?)\]/i) || trimmed.match(/\[COMIC PANEL:\s*(.+?)\]/i);
  if (illustrationMatch) {
    const src = illustrationMatch[1].trim();
    const isUrl = src.startsWith("http") || src.startsWith("/");
    // splitIntoPages overrides this to ILLUST_LINES_WORKBOOK (11) for workbook genres;
    // the base value here covers standard (full-page) mode.
    if (isUrl) return ILLUST_LINES_STANDARD; // 22
    return 10; // text placeholder box
  }

  // Sub-headers (## / ### / ####):  Playfair Display 16 px, marginTop:12 marginBottom:8.
  // Uses IDENTICAL regex to renderContentLine so the estimate always matches the render.
  const headerMatch = trimmed.match(/^#{2,}\s*\**\s*(.+?)\s*\**\s*$/);
  if (headerMatch) {
    const headerWrappedLines = Math.ceil(headerMatch[1].length / HEADER_CHARS_PER_LINE) || 1;
    return headerWrappedLines * HEADER_LINE_COST + HEADER_MARGIN_COST;
  }

  // Body text, bullets, dialogue, table rows — pixel-width-based wrap estimate.
  // Underscore `_` is ~7.5 px wide in Baskerville vs ~6.5 px for normal chars.
  // This prevents fill-in-the-blank workbook lines ("1. ___________") from being
  // under-estimated: 65 underscores × 7.5 px = 487 px → correctly rounds to 2 lines.
  const isBullet   = trimmed.startsWith("- ") || trimmed.startsWith("\u2022 ");
  const isTableRow = trimmed.startsWith("|");
  // Dialogue gets paddingLeft:16 → 444 px effective width, same budget as bullets.
  const isDialogue = trimmed.startsWith('"') || trimmed.startsWith('\u201c') || trimmed.startsWith("'");

  if (isTableRow) {
    // Table rows contain pipe chars + mixed-width content; keep the calibrated char limit.
    const wrapped = Math.ceil(trimmed.length / CHARS_PER_LINE_TABLE);
    return wrapped + 0.2;
  }

  // Pixel-width estimation for body / bullet / dialogue.
  const underscores  = (trimmed.match(/_/g) || []).length;
  const normalChars  = trimmed.length - underscores;
  const estimatedPx  = underscores * PX_PER_CHAR_WIDE + normalChars * PX_PER_CHAR_REGULAR;

  let wrapped: number;
  if (isBullet || isDialogue) {
    // paddingLeft applies to ALL lines → constant 440 px width.
    wrapped = Math.ceil(estimatedPx / CONTENT_PX_INDENTED);
  } else {
    // Body text: textIndent:20 shrinks the FIRST line to 440 px; rest are 460 px.
    // ceil((px + 20) / 460) is the exact formula for this first-line-narrowing model.
    wrapped = Math.ceil((estimatedPx + CONTENT_PX_TEXTINDENT) / CONTENT_PX_BODY);
  }
  // +0.2 covers the marginBottom:4px (4/20.625≈0.19) on every paragraph element.
  return wrapped + 0.2;
}

/**
 * Splits a long paragraph at sentence boundaries so no page ends mid-sentence.
 * Returns an array of sentence-grouped chunks, each fitting within maxLines.
 */
function splitParagraphAtSentences(para: string, maxLines: number): string[] {
  // Match sentences: anything ending in . ! ? … (including closing quotes/parens)
  const sentenceRe = /[^.!?…]+[.!?…]+[""')\]]*\s*/g;
  const rawSentences = para.match(sentenceRe);
  const sentences: string[] = rawSentences
    ? rawSentences.map(s => s.trim()).filter(Boolean)
    : [para];

  // If the regex didn't split anything useful, fall back to word-level splitting
  if (sentences.length <= 1) {
    const words = para.split(/\s+/);
    const chunks: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (estimateVisualLines(candidate) > maxLines && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? current + " " + sentence : sentence;
    if (estimateVisualLines(candidate) > maxLines && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Tries to split a paragraph at a sentence boundary that fits within remainingLines.
 * Returns { firstPart, secondPart } or null if no clean split point exists.
 */
function splitParagraphForPageBreak(
  para: string,
  remainingLines: number
): { firstPart: string; secondPart: string } | null {
  if (remainingLines < 1.2) return null;

  // Collect candidate break positions at multiple levels of granularity.
  // We try from coarsest (sentence endings) down to finest (clause markers).
  // Each level is only tried if no break was found at a coarser level.
  // This handles Philosophy/academic prose that has long single-sentence
  // paragraphs connected by semicolons, em-dashes, or colons.
  function findBreakPositions(text: string, minCarryLines: number): { firstPart: string; secondPart: string } | null {
    // Level 1 — sentence endings: . ! ? …
    const sentenceEnds: number[] = [];
    const sentRe = /[.!?…][""')\]]*\s+/g;
    let m: RegExpExecArray | null;
    while ((m = sentRe.exec(text)) !== null) {
      sentenceEnds.push(m.index + m[0].length);
    }

    // Level 2 — semicolons (same-sentence clause boundaries)
    const semiEnds: number[] = [];
    const semiRe = /;\s+/g;
    while ((m = semiRe.exec(text)) !== null) {
      semiEnds.push(m.index + m[0].length);
    }

    // Level 3 — em-dashes and colons (strong internal pauses)
    const dashEnds: number[] = [];
    const dashRe = /[—:]\s+/g;
    while ((m = dashRe.exec(text)) !== null) {
      dashEnds.push(m.index + m[0].length);
    }

    // Try each level; stop once a valid split is found.
    const levels = [sentenceEnds, semiEnds, dashEnds];
    for (const positions of levels) {
      if (positions.length === 0) continue;
      let firstPart = "";
      let bestPos = -1;
      for (const pos of positions) {
        const candidate = text.slice(0, pos).trim();
        if (estimateVisualLines(candidate) <= remainingLines) {
          firstPart = candidate;
          bestPos = pos;
        } else {
          break;
        }
      }
      if (!firstPart || bestPos < 0) continue;
      const secondPart = text.slice(bestPos).trim();
      if (estimateVisualLines(secondPart) < minCarryLines) continue;
      return { firstPart, secondPart };
    }
    return null;
  }

  // Require at least 3 carry-over lines so the continuation reads naturally
  // at the top of the next page rather than a single orphan fragment.
  return findBreakPositions(para, 3);
}

// Prefix used to mark paragraph continuations across page breaks.
// Renderer strips this and omits the opening indent so readers can see
// it flows from the previous page — exactly like printed books.
const CONT_PREFIX = "\x01CONT\x01";

function splitIntoPages(text: string, reservedLines = 0, options: { smallIllustrations?: boolean; maxLines?: number } = {}): string[][] {
  // Collapse runs of consecutive blank lines to a single blank line so that
  // chapters with many whitespace-only lines don't accumulate into blank pages.
  const rawLines = text.split("\n");
  const lines: string[] = [];
  let prevWasEmpty = false;
  for (const l of rawLines) {
    const isEmpty = l.trim() === "";
    if (isEmpty && prevWasEmpty) continue;
    lines.push(l);
    prevWasEmpty = isEmpty;
  }

  const { smallIllustrations = false, maxLines = MAX_VISUAL_LINES } = options;

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let visualCount = 0;
  let isFirstPage = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Don't let a blank line start a fresh page — it just wastes visible space.
    if (trimmedLine === "" && currentPage.length === 0) continue;
    const cost = estimateVisualLines(trimmedLine);
    const isIllustration = /\[ILLUSTRATION:/i.test(trimmedLine) || /\[IMAGE:/i.test(trimmedLine) || /\[COMIC PANEL:/i.test(trimmedLine);
    const isHeader = !isIllustration && trimmedLine.startsWith("##");
    const isSpecialLine = isIllustration || isHeader || trimmedLine.startsWith(CONT_PREFIX);
    const pageMax = isFirstPage ? maxLines - reservedLines : maxLines;

    // ── Orphan guard — headers, numbered markers, and list items ────────────
    // Applies to:
    //   • Markdown headers (##, ###)
    //   • Standalone section numbers like "2" or "2."
    //   • Numbered list items like "2. The second point..."
    // Rule: if placing this marker would leave fewer than 4 lines for the
    // content that follows, flush the page first so the marker always
    // opens a fresh page with room for its content underneath it.
    const isNumberedMarker =
      /^\d+\.?\s*$/.test(trimmedLine) ||          // "2" or "2." alone
      /^\d+\.\s+\S/.test(trimmedLine);             // "2. Some text..."
    const isOrphanCandidate = isHeader || isNumberedMarker;
    if (isOrphanCandidate && currentPage.length > 0) {
      const MIN_AFTER_MARKER = 4;
      if (pageMax - (visualCount + cost) < MIN_AFTER_MARKER) {
        pages.push([...currentPage]);
        currentPage = [];
        visualCount = 0;
        isFirstPage = false;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    const pageHasContinuation = currentPage.some(l => l.startsWith(CONT_PREFIX));
    const isUrlIllustration = isIllustration && (trimmedLine.includes('/uploads/') || trimmedLine.includes('/objstore/') || trimmedLine.includes('http'));

    // Workbook mode: URL illustrations render at ILLUST_LINES_WORKBOOK (18) lines so
    // exercise text can share the page. Standard mode: 22 lines (full-page flush).
    const effectiveCost = (smallIllustrations && isUrlIllustration) ? ILLUST_LINES_WORKBOOK : cost;

    // Flush the current page before placing an illustration.
    // Full-page mode: always flush before a URL illustration so it gets its own clean page.
    // smallIllustrations mode: only flush if the page is >60% full or has a continuation,
    // keeping the exercise text that follows on the same page.
    const shouldFlushBeforeIllus = isUrlIllustration
      ? (smallIllustrations
          ? (visualCount > pageMax * 0.6 || pageHasContinuation)
          : true)
      : (visualCount > pageMax * 0.5 || pageHasContinuation);
    if (isIllustration && shouldFlushBeforeIllus && currentPage.length > 0) {
      pages.push([...currentPage]);
      currentPage = [];
      visualCount = 0;
      isFirstPage = false;
    }

    // Paragraph longer than a full page → split it at sentence boundaries across multiple pages
    if (cost > maxLines) {
      if (currentPage.length > 0) {
        pages.push([...currentPage]);
        currentPage = [];
        visualCount = 0;
        isFirstPage = false;
      }
      const chunks = splitParagraphAtSentences(trimmedLine, maxLines);
      // Push all chunks except the last as complete standalone pages.
      // The last chunk goes into currentPage so subsequent lines (blank lines,
      // dividers, next paragraphs) can fill the remainder of that page — preventing
      // the final chunk from being stranded alone with nothing else on the page.
      for (let ci = 0; ci < chunks.length - 1; ci++) {
        pages.push([ci === 0 ? chunks[ci] : CONT_PREFIX + chunks[ci]]);
      }
      const lastChunkRaw = chunks[chunks.length - 1];
      currentPage = [chunks.length === 1 ? lastChunkRaw : CONT_PREFIX + lastChunkRaw];
      visualCount = estimateVisualLines(lastChunkRaw);
      isFirstPage = false;
      continue;
    }

    // Decorative lines (dividers like "* * *", "---") — allow slight page overfill
    // rather than letting a divider land alone on an otherwise-empty next page.
    // IMPORTANT: underscore `_` must be excluded so workbook fill-in lines like
    // "- ______________________________________" are never treated as decorative —
    // they have real height that must be budgeted and trigger normal page breaks.
    const isDecorativeLine = cost <= 1.5 && !trimmedLine.match(/[a-zA-Z0-9_]/);

    // Flush condition: always flush for non-decorative lines, and ALSO flush for decorative
    // lines once the page is already over budget (visualCount > pageMax).  This prevents
    // consecutive section-break lines ("---" × 4 with blanks between them) from each
    // bypassing the flush check and stacking a page to 34+ lines.  The single-overshoot
    // use-case is still served: if visualCount is still ≤ pageMax, one decorative line
    // is allowed to land at the end of the page without being pushed to the next page.
    if (visualCount + effectiveCost > pageMax && currentPage.length > 0 &&
        (!isDecorativeLine || visualCount > pageMax)) {
      // Try to fill the current page by splitting the paragraph at a sentence boundary.
      // Only attempt for plain body-text lines (not headers, illustrations, continuations,
      // decorative dividers, or blank lines) and only when there's meaningful space left.
      const remainingLines = pageMax - visualCount;
      if (
        !isSpecialLine &&
        !isDecorativeLine &&
        trimmedLine !== "" &&
        remainingLines >= 2
      ) {
        const split = splitParagraphForPageBreak(trimmedLine, remainingLines);
        if (split) {
          // First part fills the current page; carry-over starts the next.
          currentPage.push(split.firstPart);
          pages.push([...currentPage]);
          currentPage = [CONT_PREFIX + split.secondPart];
          visualCount = estimateVisualLines(split.secondPart);
          isFirstPage = false;
          continue;
        }
      }
      // Default: move the whole paragraph to the next page.
      pages.push([...currentPage]);
      currentPage = [];
      visualCount = 0;
      isFirstPage = false;
    }
    // Guard: after any mid-loop page reset (overflow / split / illustration flush),
    // currentPage may now be empty. Don't let a blank line start a fresh page.
    if (trimmedLine === "" && currentPage.length === 0) continue;
    currentPage.push(trimmedLine);
    visualCount += effectiveCost;

    // Full-page mode: flush immediately after placing a URL illustration so text that
    // follows goes on the next page. This lets isIllustrationOnlyPage identify the page
    // and render the image at full-page height (up to 610px) instead of the inline cap.
    // smallIllustrations mode: skip the post-flush so the exercise text below can share
    // the page with the illustration.
    if (isUrlIllustration && !smallIllustrations) {
      pages.push([...currentPage]);
      currentPage = [];
      visualCount = 0;
      isFirstPage = false;
    }
  }
  if (currentPage.length > 0) {
    // Final guard: don't emit a page that is nothing but blank lines.
    const hasContent = currentPage.some(l => {
      const t = l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length).trim() : l.trim();
      return t !== "";
    });
    if (hasContent) pages.push(currentPage);
  }
  return pages;
}

const BookPage = forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  pageNum?: number;
  totalPages?: number;
  isHardCover?: boolean;
  hardCoverStyle?: React.CSSProperties;
}>(
  ({ children, pageNum, totalPages, isHardCover, hardCoverStyle }, ref) => {
    if (isHardCover) {
      return (
        <div ref={ref} data-density="hard" style={{
          width: "100%",
          height: "100%",
          ...hardCoverStyle,
        }}>
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: PAGE_BG,
          color: PAGE_TEXT,
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Paper texture overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 28px,
            rgba(139,115,85,0.15) 28px,
            rgba(139,115,85,0.15) 29px
          )`,
          pointerEvents: "none",
        }} />
        {/* Subtle grain */}
        <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.02,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
        {pageNum != null && totalPages && (
          <div style={{
            position: "absolute",
            bottom: 16,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 11,
            color: PAGE_ACCENT,
            opacity: 0.7,
            fontWeight: 500,
            fontFamily: "'Libre Baskerville', Georgia, serif",
          }}>
            {pageNum}
          </div>
        )}
      </div>
    );
  }
);

function ColoringPageImage({ src, pageNum }: { src: string; pageNum: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: "#f8f5f0",
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "2px dashed #c8b89a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>🎨</span>
        </div>
        <p style={{
          fontSize: 11,
          color: "#9a8a70",
          fontFamily: "'Libre Baskerville', Georgia, serif",
          textAlign: "center",
          padding: "0 20px",
          lineHeight: 1.5,
        }}>
          Coloring page {pageNum} is being generated.<br />Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Coloring page ${pageNum}`}
      onError={() => setFailed(true)}
      style={{
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}

function IllustrationImage({ src, maxHeight, maxWidth, description }: {
  src: string;
  maxHeight: number;
  maxWidth: string;
  description?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div style={{
        margin: "10px auto",
        padding: "16px",
        border: `1px dashed ${PAGE_ACCENT}55`,
        borderRadius: 8,
        backgroundColor: `${PAGE_ACCENT}08`,
        textAlign: "center",
        maxWidth: "85%",
      }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: PAGE_ACCENT, opacity: 0.6, marginBottom: 4, fontFamily: "'Cinzel', serif" }}>
          Illustration
        </div>
        <p style={{ fontSize: 10, fontStyle: "italic", color: PAGE_TEXT, opacity: 0.6, fontFamily: "'Libre Baskerville', serif", lineHeight: 1.5 }}>
          {description ? description.replace(/^\/(uploads|objstore)\/illustrations\//, "").replace(/illust-\d+-\d+\.png$/, "image") : "image"}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Illustration"
      onError={() => setFailed(true)}
      style={{
        maxWidth,
        maxHeight,
        width: "auto",
        height: "auto",
        borderRadius: 6,
        border: `1px solid ${PAGE_ACCENT}33`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        display: "block",
        marginLeft: "auto",
        marginRight: "auto",
        objectFit: "contain",
      }}
    />
  );
}

function renderContentLine(line: string, idx: number, smallIllustrations = false) {
  const raw = line.trim();
  // Continuation paragraphs (flowing from the previous page) have no opening indent —
  // matching standard book typography for paragraphs that span a page break.
  const isContinuation = raw.startsWith(CONT_PREFIX);
  const trimmed = isContinuation ? raw.slice(CONT_PREFIX.length).trim() : raw;
  const paraIndent = isContinuation ? 0 : 20;

  if (trimmed === "") return <div key={idx} style={{ height: 8 }} />;

  const illustrationMatch = trimmed.match(/\[ILLUSTRATION:\s*(.+?)\]/i) || trimmed.match(/\[IMAGE:\s*(.+?)\]/i) || trimmed.match(/\[COMIC PANEL:\s*(.+?)\]/i);
  if (illustrationMatch) {
    const fullSrc = illustrationMatch[1].trim();
    // Support pipe-separated inline caption: [ILLUSTRATION: /path/img.png | Caption text]
    const pipeIdx = fullSrc.indexOf(' | ');
    const src = pipeIdx >= 0 ? fullSrc.substring(0, pipeIdx).trim() : fullSrc;
    const inlineCaption = pipeIdx >= 0 ? fullSrc.substring(pipeIdx + 3).trim() : null;
    const isUrl = src.startsWith("http") || src.startsWith("/");
    // Workbooks reserve ILLUST_LINES_WORKBOOK lines for inline illustrations so exercise
    // text shares the page. Standard mode: illustrations get their own page (full-page
    // renderer handles those), but 420px cap is a fallback for edge cases.
    const inlineMaxHeight = smallIllustrations ? ILLUST_MAX_PX_WORKBOOK : 420;
    if (isUrl) {
      return (
        <div key={idx} style={{ margin: "12px auto 4px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <IllustrationImage src={src} maxWidth="92%" maxHeight={inlineMaxHeight} description={src} />
          </div>
          {inlineCaption && (
            <p style={{ fontSize: 10.5, fontStyle: "italic", color: PAGE_TEXT, opacity: 0.6, textAlign: "center", marginTop: 5, marginBottom: 2, fontFamily: "'Libre Baskerville', serif", lineHeight: 1.4 }}>
              {inlineCaption}
            </p>
          )}
        </div>
      );
    }
    return (
      <div key={idx} style={{
        margin: "10px auto",
        padding: "14px 16px",
        border: `1px dashed ${PAGE_ACCENT}55`,
        borderRadius: 8,
        backgroundColor: `${PAGE_ACCENT}08`,
        textAlign: "center",
        maxWidth: "85%",
      }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: PAGE_ACCENT, opacity: 0.6, marginBottom: 4, fontFamily: "'Cinzel', serif" }}>
          Illustration
        </div>
        <p style={{ fontSize: 11, fontStyle: "italic", color: PAGE_TEXT, opacity: 0.7, fontFamily: "'Libre Baskerville', serif", lineHeight: 1.5 }}>
          {src}
        </p>
      </div>
    );
  }

  const subMatch = trimmed.match(/^#{2,}\s*\**\s*(.+?)\s*\**\s*$/);
  if (subMatch) {
    return (
      <h3 key={idx} style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 16,
        fontWeight: 700,
        color: PAGE_HEADING,
        marginTop: 12,
        marginBottom: 8,
      }}>
        {subMatch[1].replace(/\*+/g, "").replace(/^#+\s*/, "").trim()}
      </h3>
    );
  }

  const isDialogue = trimmed.startsWith('"') || trimmed.startsWith('\u201c') || trimmed.startsWith("'");
  const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("\u2022 ");
  const isItalicLine = trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**");
  const isTableRow = trimmed.startsWith("|");

  let cleanLine = trimmed
    .replace(/^\*\*(.+?)\*\*$/, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1");

  if (isBullet) {
    return (
      <p key={idx} style={{ paddingLeft: 20, marginBottom: 3, lineHeight: 1.65, position: "relative", fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
        <span style={{ position: "absolute", left: 6, color: PAGE_ACCENT }}>{"\u2022"}</span>
        {cleanLine.replace(/^[-\u2022]\s*/, "")}
      </p>
    );
  }

  if (isDialogue) {
    return (
      <p key={idx} style={{
        paddingLeft: 16,
        marginBottom: 4,
        lineHeight: 1.65,
        color: PAGE_TEXT,
        fontStyle: "italic",
        fontWeight: 500,
        fontFamily: "'Libre Baskerville', Georgia, serif",
        fontSize: 12.5,
      }}>
        {cleanLine}
      </p>
    );
  }

  if (isItalicLine) {
    return (
      <p key={idx} style={{
        marginBottom: 4,
        lineHeight: 1.65,
        fontStyle: "italic",
        textAlign: "center",
        fontFamily: "'Libre Baskerville', Georgia, serif",
        fontSize: 12.5,
        fontWeight: 500,
        color: PAGE_TEXT,
      }}>
        {cleanLine.replace(/^\*|\*$/g, "")}
      </p>
    );
  }

  const hasInlineEmphasis = cleanLine.includes("*");
  if (hasInlineEmphasis) {
    const parts = cleanLine.split(/(\*[^*]+\*)/g);
    return (
      <p key={idx} style={{ marginBottom: 4, lineHeight: 1.65, textAlign: "justify", textIndent: isTableRow ? 0 : paraIndent, fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
        {parts.map((part, j) =>
          part.startsWith("*") && part.endsWith("*")
            ? <em key={j}>{part.slice(1, -1)}</em>
            : <span key={j}>{part}</span>
        )}
      </p>
    );
  }

  return (
    <p key={idx} style={{ marginBottom: 4, lineHeight: 1.65, textAlign: "justify", textIndent: isTableRow ? 0 : paraIndent, fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
      {cleanLine}
    </p>
  );
}

export default function BookReader() {
  const [, draftParams] = useRoute("/read/:id");
  const [, bookParams] = useRoute("/read/book/:bookId");
  const [showToc, setShowToc] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isPortrait, setIsPortrait] = useState(window.innerWidth < 768);
  const [mobileScale, setMobileScale] = useState(() =>
    window.innerWidth < 768 ? Math.min(1, (window.innerWidth * 0.96) / 560) : 1
  );
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");
  const [showFullText, setShowFullText] = useState(false);
  const bookRef = useRef<any>(null);

  const searchString = useSearch();
  const isBookRoute = !!bookParams?.bookId;
  const paramId = bookParams?.bookId || draftParams?.id;
  const readerEmail = typeof window !== "undefined" ? localStorage.getItem("reader_email") || "" : "";

  function getReaderAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const customerToken = localStorage.getItem("ebgz_customer_token");
    if (customerToken) headers["x-customer-token"] = customerToken;
    const subToken = localStorage.getItem("ebgz_sub_token");
    if (subToken) headers["X-Subscription-Token"] = subToken;
    const orderToken = localStorage.getItem("ebgz_order_token");
    if (orderToken) headers["x-order-token"] = orderToken;
    const adminToken = localStorage.getItem("ebgz_admin_token");
    if (adminToken) headers["x-admin-token"] = adminToken;
    return headers;
  }

  useEffect(() => {
    const handleResize = () => {
      const vw = window.innerWidth;
      setIsPortrait(vw < 768);
      setMobileScale(vw < 768 ? Math.min(1, (vw * 0.96) / 560) : 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: resolvedDraftId, isLoading: isResolvingDraftId, isError: resolverError } = useQuery<number>({
    queryKey: ["book-draft-id", bookParams?.bookId, readerEmail],
    queryFn: async () => {
      const r = await fetch(`/api/books/${bookParams?.bookId}/draft-id`, { headers: getReaderAuthHeaders() });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        if (r.status === 403 || r.status === 401) {
          setAccessDenied(true);
          setAccessMessage(body.message || "You need access to read this book.");
          throw new Error("access_denied");
        }
        throw new Error("No readable content");
      }
      setAccessDenied(false);
      const data = await r.json();
      return data.draftId;
    },
    enabled: isBookRoute,
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const draftId = isBookRoute ? resolvedDraftId : paramId ? parseInt(paramId) : undefined;

  const { data: draft, isLoading, isError: draftError } = useQuery<DraftEbook>({
    queryKey: ["draft-read", draftId, isBookRoute, readerEmail],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isBookRoute && bookParams?.bookId) params.set("bookId", bookParams.bookId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const headers: Record<string, string> = { ...getReaderAuthHeaders() };
      const adminToken = localStorage.getItem("ebgz_admin_token");
      if (adminToken) headers["x-admin-token"] = adminToken;
      const r = await fetch(`/api/content-studio/drafts/${draftId}/read${qs}`, { headers });
      if (!r.ok) {
        if (r.status === 403 || r.status === 401) {
          setAccessDenied(true);
          setAccessMessage("You need access to read this book.");
          throw new Error("access_denied");
        }
        throw new Error("Failed to load book");
      }
      return r.json();
    },
    enabled: !!draftId,
    retry: 1,
  });

  const genreColors = useMemo(() => getGenreColors(draft?.genre || ""), [draft?.genre]);
  const isColoringBook = draft?.content?.includes("**Coloring Book**") || draft?.genre?.toLowerCase().includes("coloring") || false;
  const isClassicBook = draft?.genre?.startsWith("Classic") || false;
  const classicAuthor = useMemo(() => {
    if (!isClassicBook || !draft?.topic) return "";
    const match = draft.topic.match(/by\s+(.+?)\.\s/);
    return match ? match[1] : "";
  }, [isClassicBook, draft?.topic]);
  const publisherLabel = isClassicBook && classicAuthor ? classicAuthor : "EbookGamez";
  const chapters = useMemo(() => draft?.content ? parseChapters(draft.content) : [], [draft?.content]);

  const allPages = useMemo(() => {
    if (!draft) return [];
    const pages: { type: string; content: any }[] = [];

    pages.push({ type: "front-cover", content: { title: draft.title, genre: draft.genre, coverUrl: draft.coverUrl } });

    pages.push({ type: "inner-front", content: {} });

    pages.push({ type: "title", content: { title: draft.title, genre: draft.genre } });

    if (isColoringBook) {
      // Parse per-page guided content (intention, breathing guide, challenge)
      const rawContent = draft.content || "";
      const pageBlockRegex = /\*\*Page\s+(\d+):\*\*\s*([\s\S]*?)(?=\*\*Page\s+\d+:\*\*|$)/g;
      const guidedMap: Record<number, { intention?: string; breathing?: string; challenge?: string }> = {};
      let m: RegExpExecArray | null;
      while ((m = pageBlockRegex.exec(rawContent)) !== null) {
        const pageIdx = parseInt(m[1]);
        const block = m[2] || "";
        const intentionMatch = block.match(/>\s*\*Today['']s Intention:\*\s*(.+)/i);
        const breathingMatch = block.match(/\*\*Breathing Guide:\*\*\s*(.+)/i);
        const challengeMatch = block.match(/\*\*Daily Calm Challenge:\*\*\s*([\s\S]+?)(?=\n\n|\n\*\*|\*\*Page|$)/i);
        if (intentionMatch || breathingMatch || challengeMatch) {
          guidedMap[pageIdx] = {
            intention: intentionMatch ? intentionMatch[1].trim() : undefined,
            breathing: breathingMatch ? breathingMatch[1].trim() : undefined,
            challenge: challengeMatch ? challengeMatch[1].trim() : undefined,
          };
        }
      }
      const pageMatches = rawContent.match(/\*\*Page\s+(\d+):\*\*/g);
      const totalColoringPages = pageMatches ? pageMatches.length : 30;
      for (let i = 1; i <= totalColoringPages; i++) {
        const pageNum = String(i).padStart(3, '0');
        pages.push({ 
          type: "coloring-page", 
          content: { 
            pageNum: i, 
            imageUrl: `/objstore/coloring-pages/${draft.id}/page-${pageNum}.png` 
          } 
        });
        const guided = guidedMap[i];
        if (guided && (guided.intention || guided.breathing || guided.challenge)) {
          pages.push({ type: "guided-page", content: { pageNum: i, ...guided } });
        }
      }
    } else {
      const chapterTitles = chapters.map(c => c.title);
      const TOC_MAX_HEIGHT = 520;
      const TOC_HEADER_HEIGHT = 60;
      const TOC_CHARS_PER_LINE = 42;
      const TOC_LINE_HEIGHT = 18;
      const TOC_ENTRY_PADDING = 10;
      let tocPages: { titles: string[]; startIndex: number; isFirst: boolean }[] = [];
      let currentTocPage: string[] = [];
      let currentHeight = TOC_HEADER_HEIGHT;
      let startIdx = 0;
      for (let i = 0; i < chapterTitles.length; i++) {
        const cleanTitle = chapterTitles[i].replace(/^Chapter\s+\d+[:\s-]*/i, "").trim() || chapterTitles[i];
        const lines = Math.max(1, Math.ceil(cleanTitle.length / TOC_CHARS_PER_LINE));
        const entryHeight = lines * TOC_LINE_HEIGHT + TOC_ENTRY_PADDING;
        if (currentHeight + entryHeight > TOC_MAX_HEIGHT && currentTocPage.length > 0) {
          tocPages.push({ titles: [...currentTocPage], startIndex: startIdx, isFirst: startIdx === 0 });
          currentTocPage = [];
          startIdx = i;
          currentHeight = 20;
        }
        currentTocPage.push(chapterTitles[i]);
        currentHeight += entryHeight;
      }
      if (currentTocPage.length > 0) {
        tocPages.push({ titles: currentTocPage, startIndex: startIdx, isFirst: startIdx === 0 });
      }
      for (const tp of tocPages) {
        pages.push({ type: "toc", content: { chapters: tp.titles, startIndex: tp.startIndex, isFirst: tp.isFirst } });
      }

      let aboutText = "";
      if (draft.content) {
        const aboutMatch = draft.content.match(/##\s*About\s+this\s+Book\s*\n+([\s\S]*?)(?=\n---|\n##\s*Chapter\s+\d)/i);
        if (aboutMatch) {
          // Strip illustration markers — the About section is a blurb, not an illustrated page
          aboutText = aboutMatch[1]
            .replace(/\[ILLUSTRATION:[^\]]*\]/gi, "")
            .replace(/\[IMAGE:[^\]]*\]/gi, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        }
      }
      if (aboutText) {
        // Reserve 4 lines for heading + divider on the first description page
        const descPagesLines = splitIntoPages(aboutText, 4);
        descPagesLines.forEach((pageLines, idx) => {
          pages.push({ type: "description", content: { lines: pageLines, isFirst: idx === 0 } });
        });
      }

      // Workbooks, activity books, and journals display illustrations at ~220px so the
      // exercise text can appear on the same page below the image — matching professional
      // workbook layout (vs. art/photography books where illustrations fill the full page).
      const SMALL_ILLUS_GENRES = ['Workbooks', 'Activity Books', 'Guided Journals'];
      const isWorkbookGenre = SMALL_ILLUS_GENRES.some(g =>
        (draft.genre || '').toLowerCase().includes(g.toLowerCase())
      );

      for (const chapter of chapters) {
        pages.push({ type: "chapter-title", content: { number: chapter.number, title: chapter.title } });

        const contentPages = splitIntoPages(chapter.content, 0, {
          smallIllustrations: isWorkbookGenre,
          maxLines: isWorkbookGenre ? WORKBOOK_MAX_VISUAL_LINES : MAX_VISUAL_LINES,
        });
        for (const pageLinesArr of contentPages) {
          pages.push({ type: "content", content: { lines: pageLinesArr, chapterTitle: chapter.title } });
        }
      }
    }

    pages.push({ type: "end", content: { title: draft.title } });

    pages.push({ type: "inner-back", content: {} });

    pages.push({ type: "back-cover", content: { title: draft.title, genre: draft.genre } });

    if (pages.length % 2 !== 0) {
      pages.splice(pages.length - 1, 0, { type: "blank", content: {} });
    }

    return pages;
  }, [draft, chapters, isColoringBook]);

  const wordCount = useMemo(() => {
    if (!draft?.content) return 0;
    return draft.content.split(/\s+/).length;
  }, [draft?.content]);

  const handleFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
  }, []);

  const goToPage = useCallback((pageIndex: number) => {
    if (bookRef.current) {
      bookRef.current.pageFlip().flip(pageIndex);
    }
    setShowToc(false);
  }, []);

  const tocChapterPages = useMemo(() => {
    const result: { title: string; pageIndex: number }[] = [];
    let idx = 0;
    for (const page of allPages) {
      if (page.type === "chapter-title") {
        result.push({ title: page.content.title, pageIndex: idx });
      }
      idx++;
    }
    return result;
  }, [allPages]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!bookRef.current) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); bookRef.current.pageFlip().flipNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); bookRef.current.pageFlip().flipPrev(); }
      if (e.key === "Escape") setShowToc(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const readProgress = allPages.length > 1 ? Math.min(1, currentPage / (allPages.length - 1)) : 0;
  const leftEdgeThickness = Math.max(2, Math.round(readProgress * 20));
  const rightEdgeThickness = Math.max(2, 20 - leftEdgeThickness);

  if (isLoading || (isBookRoute && isResolvingDraftId)) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-amber-100 text-lg animate-pulse font-serif">Opening book...</div>
      </div>
    );
  }

  if (accessDenied) {
    const handleAdminLogin = async () => {
      setAdminLoginError("");
      try {
        const r = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPassword }),
        });
        if (r.ok) {
          const data = await r.json();
          localStorage.setItem("ebgz_admin_token", data.token);
          setAdminPassword("");
          setAccessDenied(false);
        } else {
          setAdminLoginError("Incorrect password");
        }
      } catch {
        setAdminLoginError("Login failed");
      }
    };

    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center gap-6 px-4">
        <BookOpen className="h-16 w-16 text-amber-500/50" />
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-display text-amber-200 mb-3">Access Required</h2>
          <p className="text-stone-400 font-serif mb-4">{accessMessage}</p>

          <div className="mb-6 p-4 rounded-lg border border-stone-700 bg-stone-800/50">
            <p className="text-sm text-stone-400 mb-3">Admin access:</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                placeholder="Enter admin password"
                className="flex-1 px-3 py-2 rounded bg-stone-900 border border-stone-600 text-white text-sm focus:border-amber-500 focus:outline-none"
                data-testid="input-admin-password"
              />
              <Button
                onClick={handleAdminLogin}
                className="bg-amber-600 hover:bg-amber-500 text-white text-sm"
                data-testid="button-admin-login"
              >
                Unlock
              </Button>
            </div>
            {adminLoginError && <p className="text-red-400 text-xs mt-2">{adminLoginError}</p>}
          </div>

          <div className="flex flex-col gap-3 items-center">
            <Link href="/subscription">
              <Button className="bg-amber-600 text-white hover:bg-amber-500 font-display px-8 py-5" data-testid="link-get-reading-pass">
                <BookOpen className="h-4 w-4 mr-2" /> Get a Reading Pass
              </Button>
            </Link>
            <Link href={`/book/${bookParams?.bookId}`}>
              <Button variant="outline" className="text-amber-300 border-amber-700" data-testid="link-back-to-book">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Book
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (resolverError || draftError || !draft || !draft.content) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center gap-4">
        <BookOpen className="h-16 w-16 text-stone-600" />
        <p className="text-stone-400 text-lg font-serif">
          {resolverError || draftError ? "This book is not available for reading right now." : "This book has no content yet."}
        </p>
        <Link href="/">
          <Button variant="outline" className="text-amber-300 border-amber-700" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  const coverStyle: React.CSSProperties = {
    background: `linear-gradient(145deg, ${genreColors.coverBg}, ${genreColors.spine})`,
    borderRadius: "3px",
    boxShadow: "inset 0 0 30px rgba(0,0,0,0.3), inset 0 0 4px rgba(255,255,255,0.05)",
    overflow: "hidden",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #2a2420 0%, #0f0d0b 70%)" }}
      data-testid="book-reader"
    >
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-stone-400 hover:text-amber-300" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 mr-1" /> Home
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="text-stone-400 hover:text-amber-300" onClick={() => setShowToc(!showToc)} data-testid="button-toc">
            <List className="h-4 w-4 mr-1" /> Contents
          </Button>
          <Button variant="ghost" size="sm" className="text-stone-400 hover:text-amber-300" data-testid="button-full-text"
            onClick={() => setShowFullText(true)}>
            <BookOpen className="h-4 w-4 mr-1" /> Full Text
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-stone-500 text-xs hidden md:inline">
            {wordCount.toLocaleString()} words | {chapters.length} chapters
          </span>
          <span className="text-stone-500 text-sm font-mono" data-testid="text-page-number">
            {currentPage + 1} / {allPages.length}
          </span>
        </div>
      </div>

      {/* Book title always visible above */}
      <div className="mb-3 mt-14 text-center px-4">
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 20,
            fontWeight: 700,
            color: genreColors.accent,
            letterSpacing: 1,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
          data-testid="text-reader-title"
        >
          {draft.title}
        </h1>
      </div>

      {/* TOC Sidebar */}
      {showToc && (
        <>
          <div className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={() => setShowToc(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-80 z-40 p-6 pt-14 overflow-y-auto shadow-2xl border-r border-amber-900/20"
            style={{ backgroundColor: PAGE_BG }}>
            <div className="flex justify-between items-center mb-6">
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 20,
                fontWeight: 700,
                color: PAGE_HEADING,
              }}>Contents</h2>
              <button onClick={() => setShowToc(false)} style={{ color: PAGE_TEXT, opacity: 0.4 }} data-testid="button-close-toc">
                <X className="h-5 w-5" />
              </button>
            </div>
            {draft.coverUrl && (
              <div className="mb-6 flex justify-center">
                <img src={draft.coverUrl} alt={draft.title} className="w-28 h-40 object-cover rounded shadow-lg" />
              </div>
            )}
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: PAGE_HEADING, textAlign: "center", marginBottom: 4 }}>
              {draft.title}
            </p>
            <p style={{ fontSize: 11, color: PAGE_ACCENT, textAlign: "center", marginBottom: 16 }}>
              {draft.genre} | {wordCount.toLocaleString()} words
            </p>
            <div style={{ height: 1, background: "rgba(139,115,85,0.2)", marginBottom: 12 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tocChapterPages.map((ch, idx) => (
                <button
                  key={idx}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: "'Libre Baskerville', Georgia, serif",
                    background: currentPage === ch.pageIndex ? "rgba(139,115,85,0.1)" : "transparent",
                    color: currentPage === ch.pageIndex ? PAGE_HEADING : PAGE_TEXT,
                    fontWeight: currentPage === ch.pageIndex ? 600 : 400,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                  onClick={() => goToPage(ch.pageIndex)}
                  data-testid={`toc-chapter-${idx}`}
                >
                  <span style={{ fontSize: 11, color: PAGE_ACCENT, minWidth: 18 }}>
                    {idx + 1}.
                  </span>
                  <span style={{ flex: 1 }}>
                    {ch.title.replace(/^Chapter\s+\d+[:\s-]*/i, "").trim() || ch.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Book container with realistic edges */}
      {/* On mobile the book renders at full 500px and is scaled down via CSS transform so
          the pagination line-count math (which assumes 460px content width) stays correct. */}
      <div style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        height: mobileScale < 1 ? `${Math.ceil((680 + 16) * mobileScale)}px` : undefined,
        overflow: "visible",
        flexShrink: 0,
      }}>
      <div className="relative" style={{
        maxWidth: isPortrait ? undefined : 1100,
        width: isPortrait ? "560px" : "95%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: mobileScale < 1 ? `scale(${mobileScale})` : undefined,
        transformOrigin: "top center",
      }}>

        {/* Left page edge (read pages stack) */}
        <div style={{
          position: "absolute",
          left: -leftEdgeThickness - 2,
          top: 6,
          bottom: 6,
          width: leftEdgeThickness,
          background: `repeating-linear-gradient(
            to right,
            #e8e0d0,
            #d8d0c0 1px,
            #ece4d4 1px,
            #e0d8c8 2px
          )`,
          borderRadius: "2px 0 0 2px",
          boxShadow: "-2px 0 6px rgba(0,0,0,0.25)",
          zIndex: 0,
          transition: "width 0.5s ease",
        }} />

        {/* Right page edge (unread pages stack) */}
        <div style={{
          position: "absolute",
          right: -rightEdgeThickness - 2,
          top: 6,
          bottom: 6,
          width: rightEdgeThickness,
          background: `repeating-linear-gradient(
            to left,
            #e8e0d0,
            #d8d0c0 1px,
            #ece4d4 1px,
            #e0d8c8 2px
          )`,
          borderRadius: "0 2px 2px 0",
          boxShadow: "2px 0 6px rgba(0,0,0,0.25)",
          zIndex: 0,
          transition: "width 0.5s ease",
        }} />

        {/* Top edge */}
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -4,
          height: 5,
          background: "linear-gradient(to bottom, #d0c8b8, #ddd5c5)",
          borderRadius: "2px 2px 0 0",
          zIndex: 0,
        }} />

        {/* Bottom edge */}
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -4,
          height: 5,
          background: "linear-gradient(to top, #c8c0b0, #d8d0c0)",
          borderRadius: "0 0 2px 2px",
          zIndex: 0,
          boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
        }} />

        {/* Center spine shadow (visible when book is open in landscape mode) */}
        {!isPortrait && (
          <div style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 30,
            transform: "translateX(-50%)",
            background: "linear-gradient(to right, rgba(0,0,0,0.08), rgba(0,0,0,0.15), rgba(0,0,0,0.08))",
            zIndex: 5,
            pointerEvents: "none",
          }} />
        )}

        {/* @ts-ignore */}
        <HTMLFlipBook
          ref={bookRef}
          width={500}
          height={680}
          size={isPortrait ? "fixed" : "stretch"}
          minWidth={250}
          maxWidth={550}
          minHeight={350}
          maxHeight={750}
          showCover={true}
          mobileScrollSupport={true}
          onFlip={handleFlip}
          className="book-flip-realistic"
          style={{ position: "relative", zIndex: 2 }}
          maxShadowOpacity={0.6}
          drawShadow={true}
          flippingTime={800}
          usePortrait={isPortrait}
          startZIndex={0}
          autoSize={true}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
          startPage={0}
        >
          {allPages.map((page, pageIndex) => {
            const VIRTUALIZE_WINDOW = 10;
            const isNearby = Math.abs(pageIndex - currentPage) <= VIRTUALIZE_WINDOW;
            const isSpecialPage = page.type === "front-cover" || page.type === "back-cover" || page.type === "inner-front" || page.type === "inner-back";
            if (!isNearby && !isSpecialPage && allPages.length > 60) {
              return (
                <BookPage key={pageIndex}>
                  <div style={{ height: "100%", background: PAGE_BG }} />
                </BookPage>
              );
            }
            if (page.type === "front-cover") {
              return (
                <BookPage key={pageIndex} isHardCover hardCoverStyle={coverStyle}>
                  <div style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {page.content.coverUrl ? (
                      <img
                        src={page.content.coverUrl}
                        alt={page.content.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                      />
                    ) : (
                      <>
                        <div style={{
                          position: "absolute", inset: 0,
                          background: `linear-gradient(135deg, ${genreColors.coverBg}, ${genreColors.spine})`,
                        }} />
                        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: 40 }}>
                          <div style={{ width: 60, height: 1, backgroundColor: genreColors.accent, opacity: 0.4, margin: "0 auto 30px" }} />
                          <h1 style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: 26,
                            fontWeight: 700,
                            color: genreColors.coverText,
                            lineHeight: 1.3,
                          }}>
                            {page.content.title}
                          </h1>
                          <div style={{ width: 40, height: 1, backgroundColor: genreColors.accent, opacity: 0.3, margin: "24px auto" }} />
                          <p style={{
                            fontFamily: "'Cinzel', serif",
                            fontSize: 10,
                            letterSpacing: 5,
                            textTransform: "uppercase",
                            color: genreColors.accent,
                            opacity: 0.7,
                          }}>
                            {publisherLabel}
                          </p>
                        </div>
                      </>
                    )}
                    {/* Leather texture overlay */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
                      pointerEvents: "none",
                    }} />
                  </div>
                </BookPage>
              );
            }

            if (page.type === "inner-front") {
              return (
                <BookPage key={pageIndex}>
                  <div style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(135deg, ${PAGE_BG}, #ede5d5)`,
                  }}>
                    <div style={{
                      width: 80,
                      height: 80,
                      border: `1px solid ${PAGE_ACCENT}`,
                      opacity: 0.15,
                      borderRadius: "50%",
                    }} />
                  </div>
                </BookPage>
              );
            }

            if (page.type === "title") {
              return (
                <BookPage key={pageIndex}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    padding: "40px 28px",
                    textAlign: "center",
                  }}>
                    <div style={{ width: 60, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.3, marginBottom: 40 }} />
                    <h1 style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 26,
                      fontWeight: 700,
                      color: PAGE_HEADING,
                      lineHeight: 1.3,
                      marginBottom: 20,
                    }} data-testid="text-book-title">
                      {page.content.title}
                    </h1>
                    <div style={{ width: 40, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.2, margin: "16px 0" }} />
                    <p style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 12,
                      letterSpacing: 4,
                      textTransform: "uppercase",
                      color: PAGE_ACCENT,
                      marginTop: 16,
                    }} data-testid="text-book-author">
                      {publisherLabel}
                    </p>
                    <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontStyle: "italic", fontFamily: "'Libre Baskerville', serif", color: PAGE_ACCENT }}>
                        A {page.content.genre} Book
                      </span>
                      <span style={{ fontSize: 10, color: PAGE_ACCENT, opacity: 0.6 }}>
                        {chapters.length} chapters | {wordCount.toLocaleString()} words
                      </span>
                    </div>
                    <div style={{ width: 60, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.3, marginTop: 40 }} />
                  </div>
                </BookPage>
              );
            }

            if (page.type === "toc") {
              const startIdx = page.content.startIndex || 0;
              const isFirst = page.content.isFirst !== false;
              return (
                <BookPage key={pageIndex} pageNum={pageIndex} totalPages={allPages.length}>
                  <div style={{ padding: "32px 24px", height: "100%", overflow: "hidden" }}>
                    {isFirst && (
                      <>
                        <h2 style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: 18,
                          fontWeight: 700,
                          color: PAGE_HEADING,
                          textAlign: "center",
                          marginBottom: 6,
                        }}>
                          Table of Contents
                        </h2>
                        <div style={{ width: 40, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.25, margin: "10px auto 18px" }} />
                      </>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {page.content.chapters.map((title: string, idx: number) => {
                        const globalIdx = startIdx + idx;
                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 10,
                              padding: "4px 0",
                              borderBottom: "1px dotted rgba(139,115,85,0.2)",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              const chapterPage = tocChapterPages[globalIdx];
                              if (chapterPage) goToPage(chapterPage.pageIndex);
                            }}
                          >
                            <span style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: 12,
                              color: PAGE_ACCENT,
                              minWidth: 22,
                              fontWeight: 600,
                            }}>
                              {globalIdx + 1}
                            </span>
                            <span style={{
                              fontFamily: "'Libre Baskerville', Georgia, serif",
                              fontSize: 13,
                              color: PAGE_TEXT,
                              flex: 1,
                              lineHeight: 1.5,
                            }}>
                              {title.replace(/^Chapter\s+\d+[:\s-]*/i, "").trim() || title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </BookPage>
              );
            }

            if (page.type === "description") {
              return (
                <BookPage key={pageIndex} pageNum={pageIndex} totalPages={allPages.length}>
                  <div style={{ padding: "32px 24px", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {page.content.isFirst ? (
                      <>
                        <h2 style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: 16,
                          fontWeight: 700,
                          color: PAGE_HEADING,
                          textAlign: "center",
                          marginBottom: 6,
                          flexShrink: 0,
                        }}>
                          About This Book
                        </h2>
                        <div style={{ width: 40, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.25, margin: "10px auto 18px", flexShrink: 0 }} />
                      </>
                    ) : (
                      <div style={{ width: 40, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.25, margin: "8px auto 12px", flexShrink: 0 }} />
                    )}
                    <div style={{
                      fontFamily: "'Libre Baskerville', Georgia, serif",
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: 1.65,
                      color: PAGE_TEXT,
                      textAlign: "justify",
                      flex: 1,
                      overflow: "hidden",
                    }}>
                      {(page.content.lines as string[]).map((para: string, idx: number) => {
                        const isCont = para.trim().startsWith(CONT_PREFIX);
                        const text = isCont ? para.trim().slice(CONT_PREFIX.length).trim() : para.trim();
                        return text
                          ? <p key={idx} style={{ marginBottom: 6, textIndent: isCont ? 0 : 20 }}>{text}</p>
                          : <div key={idx} style={{ height: 4 }} />;
                      })}
                    </div>
                  </div>
                </BookPage>
              );
            }

            if (page.type === "coloring-page") {
              return (
                <BookPage key={pageIndex} pageNum={undefined} totalPages={undefined}>
                  <div style={{ 
                    width: "100%", 
                    height: "100%", 
                    display: "flex", 
                    flexDirection: "column",
                    alignItems: "center", 
                    justifyContent: "center",
                    backgroundColor: "#ffffff",
                    padding: "4px",
                    position: "relative",
                    zIndex: 2,
                  }}>
                    <ColoringPageImage
                      src={page.content.imageUrl}
                      pageNum={page.content.pageNum}
                    />
                    <span style={{ 
                      position: "absolute",
                      bottom: 4,
                      fontSize: 9, 
                      color: "#bbb", 
                      fontFamily: "'Libre Baskerville', Georgia, serif",
                    }}>
                      {page.content.pageNum}
                    </span>
                  </div>
                </BookPage>
              );
            }

            if (page.type === "guided-page") {
              const { pageNum, intention, breathing, challenge } = page.content as {
                pageNum: number; intention?: string; breathing?: string; challenge?: string;
              };
              return (
                <BookPage key={pageIndex} pageNum={undefined} totalPages={undefined}>
                  <div style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    backgroundColor: "#1a1410",
                    padding: "28px 24px",
                    gap: 20,
                    fontFamily: "'Libre Baskerville', Georgia, serif",
                  }}>
                    <div style={{ textAlign: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: "#8a7a60", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                        Page {pageNum} · Guided Prompts
                      </span>
                    </div>
                    {intention && (
                      <div style={{
                        borderLeft: "3px solid #c8a96e",
                        paddingLeft: 14,
                        paddingTop: 4,
                        paddingBottom: 4,
                      }}>
                        <div style={{ fontSize: 8.5, color: "#c8a96e", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                          Today's Intention
                        </div>
                        <div style={{ fontSize: 11, color: "#e8d8b8", lineHeight: 1.65, fontStyle: "italic" }}>
                          {intention}
                        </div>
                      </div>
                    )}
                    {breathing && (
                      <div style={{
                        borderLeft: "3px solid #7ab8a8",
                        paddingLeft: 14,
                        paddingTop: 4,
                        paddingBottom: 4,
                      }}>
                        <div style={{ fontSize: 8.5, color: "#7ab8a8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                          Breathing Guide
                        </div>
                        <div style={{ fontSize: 11, color: "#c8ddd8", lineHeight: 1.65 }}>
                          {breathing}
                        </div>
                      </div>
                    )}
                    {challenge && (
                      <div style={{
                        borderLeft: "3px solid #b89ac8",
                        paddingLeft: 14,
                        paddingTop: 4,
                        paddingBottom: 4,
                      }}>
                        <div style={{ fontSize: 8.5, color: "#b89ac8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                          Daily Calm Challenge
                        </div>
                        <div style={{ fontSize: 11, color: "#d8c8e8", lineHeight: 1.65 }}>
                          {challenge}
                        </div>
                      </div>
                    )}
                    <div style={{ textAlign: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 18, opacity: 0.25 }}>✦</span>
                    </div>
                  </div>
                </BookPage>
              );
            }

            if (page.type === "chapter-title") {
              return (
                <BookPage key={pageIndex}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    padding: "40px 28px",
                    textAlign: "center",
                  }}>
                    <div style={{ flex: 1 }} />
                    <span style={{
                      fontSize: 13,
                      color: PAGE_ACCENT,
                      fontWeight: 600,
                      letterSpacing: 5,
                      textTransform: "uppercase",
                      marginBottom: 20,
                      fontFamily: "'Cinzel', serif",
                    }}>
                      Chapter {page.content.number}
                    </span>
                    <div style={{ width: 50, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.4, marginBottom: 20 }} />
                    <h2 style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 22,
                      fontWeight: 700,
                      color: PAGE_HEADING,
                      lineHeight: 1.4,
                      maxWidth: 350,
                    }} data-testid="text-chapter-title">
                      {page.content.title.replace(/^Chapter\s+\d+[:\s-]*/i, "").trim() || page.content.title}
                    </h2>
                    <div style={{ width: 30, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.2, marginTop: 20 }} />
                    <div style={{ flex: 1 }} />
                  </div>
                </BookPage>
              );
            }

            if (page.type === "end") {
              return (
                <BookPage key={pageIndex}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    padding: "40px 28px",
                    textAlign: "center",
                  }}>
                    <div style={{ width: 50, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.2, marginBottom: 30 }} />
                    <p style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 14,
                      letterSpacing: 6,
                      textTransform: "uppercase",
                      color: PAGE_ACCENT,
                    }}>
                      The End
                    </p>
                    <p style={{
                      fontFamily: "'Libre Baskerville', serif",
                      fontSize: 12,
                      color: PAGE_TEXT,
                      opacity: 0.5,
                      marginTop: 20,
                      fontStyle: "italic",
                    }}>
                      Thank you for reading
                    </p>
                    <div style={{ width: 50, height: 1, backgroundColor: PAGE_ACCENT, opacity: 0.2, marginTop: 30 }} />
                    <p style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 10,
                      letterSpacing: 4,
                      textTransform: "uppercase",
                      color: PAGE_ACCENT,
                      opacity: 0.4,
                      marginTop: 30,
                    }}>
                      {publisherLabel}
                    </p>
                  </div>
                </BookPage>
              );
            }

            if (page.type === "blank") {
              return (
                <BookPage key={pageIndex}>
                  <div style={{ height: "100%", background: PAGE_BG }} />
                </BookPage>
              );
            }

            if (page.type === "inner-back") {
              return (
                <BookPage key={pageIndex}>
                  <div style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(135deg, #ede5d5, ${PAGE_BG})`,
                  }} />
                </BookPage>
              );
            }

            if (page.type === "back-cover") {
              return (
                <BookPage key={pageIndex} isHardCover hardCoverStyle={coverStyle}>
                  <div style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 40,
                  }}>
                    <p style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 11,
                      letterSpacing: 5,
                      textTransform: "uppercase",
                      color: genreColors.accent,
                      opacity: 0.6,
                    }}>
                      {publisherLabel}
                    </p>
                    <p style={{
                      fontFamily: "'Libre Baskerville', serif",
                      fontSize: 11,
                      color: genreColors.coverText,
                      opacity: 0.4,
                      marginTop: 12,
                      fontStyle: "italic",
                    }}>
                      {page.content.genre}
                    </p>
                  </div>
                </BookPage>
              );
            }

            return (() => {
              // Detect illustration-only pages: all non-empty lines are illustration markers
              const nonEmptyLines = (page.content.lines as string[]).filter((l: string) => l.trim() !== "");
              const isIllustrationOnlyPage = nonEmptyLines.length > 0 && nonEmptyLines.every((l: string) =>
                /\[ILLUSTRATION:/i.test(l) || /\[IMAGE:/i.test(l) || /\[COMIC PANEL:/i.test(l)
              );

              // Workbook genres keep a consistent size even on illustration-only pages
              const WORKBOOK_GENRES_ILLUS = ['Workbooks', 'Activity Books', 'Guided Journals'];
              const isWorkbookIllus = WORKBOOK_GENRES_ILLUS.some(g =>
                (draft?.genre || '').toLowerCase().includes(g.toLowerCase())
              );

              if (isIllustrationOnlyPage) {
                // Full-page illustration: no overflow clipping, centered with flex
                return (
                  <BookPage key={pageIndex} pageNum={pageIndex} totalPages={allPages.length}>
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", boxSizing: "border-box" }}>
                      {page.content.chapterTitle && (
                        <div style={{ fontSize: 10, color: PAGE_ACCENT, opacity: 0.6, textAlign: "center", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                          {(() => { let h = page.content.chapterTitle as string; h = h.replace(/--\s*_?continued_?\.?/gi, "").replace(/\s*\(_?continued_?\)/gi, "").replace(/\s*--\s*$/, "").trim(); return h; })()}
                        </div>
                      )}
                      {nonEmptyLines.map((line: string, idx: number) => {
                        const m = line.match(/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\s*(.+?)\]/i);
                        if (!m) return null;
                        const fullSrc = m[1].trim();
                        // Support pipe-separated inline caption: [ILLUSTRATION: /path/img.png | Caption]
                        const pipeIdx = fullSrc.indexOf(' | ');
                        const src = pipeIdx >= 0 ? fullSrc.substring(0, pipeIdx).trim() : fullSrc;
                        const caption = pipeIdx >= 0 ? fullSrc.substring(pipeIdx + 3).trim() : null;
                        const hasCaption = !!caption;
                        // Workbook genres use a consistent mid-size so full-page illustrations
                        // match inline ones — avoids jarring size jumps between pages.
                        const fullPageMaxHeight = isWorkbookIllus
                          ? ILLUST_MAX_PX_WORKBOOK
                          : (page.content.chapterTitle || hasCaption ? 560 : 635);
                        return (
                          <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                            <IllustrationImage
                              src={src}
                              maxHeight={fullPageMaxHeight}
                              maxWidth="96%"
                              description={src}
                            />
                            {hasCaption && (
                              <p style={{ fontSize: 10.5, fontStyle: "italic", color: PAGE_TEXT, opacity: 0.6, textAlign: "center", marginTop: 8, marginBottom: 0, fontFamily: "'Libre Baskerville', serif", lineHeight: 1.4, maxWidth: "88%" }}>
                                {caption}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </BookPage>
                );
              }

              return (() => {
                const pageLines = page.content.lines as string[];

                return (
                <BookPage key={pageIndex} pageNum={pageIndex} totalPages={allPages.length}>
                  <div style={{
                    padding: "16px 20px 28px",
                    height: "100%",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    {page.content.chapterTitle && (
                      <div style={{
                        fontSize: 10,
                        color: PAGE_ACCENT,
                        opacity: 0.7,
                        textAlign: "center",
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        marginBottom: 12,
                        fontFamily: "'Cinzel', serif",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        {(() => {
                          let h = page.content.chapterTitle as string;
                          h = h.replace(/--\s*_?continued_?\.?/gi, "").replace(/\s*\(_?continued_?\)/gi, "").replace(/\s*--\s*$/, "").trim();
                          return h;
                        })()}
                      </div>
                    )}
                    {/* Small gap between chapter header and content (~1 line) */}
                    <div style={{ height: 20, flexShrink: 0 }} />
                    <div style={{ flexShrink: 0 }}>
                      {(() => {
                        const WORKBOOK_GENRES_RENDER = ['Workbooks', 'Activity Books', 'Guided Journals'];
                        const isWorkbook = WORKBOOK_GENRES_RENDER.some(g =>
                          (draft?.genre || '').toLowerCase().includes(g.toLowerCase())
                        );
                        return pageLines.map((line: string, idx: number) =>
                          renderContentLine(line, idx, isWorkbook)
                        );
                      })()}
                    </div>
                  </div>
                </BookPage>
                );
              })();
            })();
          })}
        </HTMLFlipBook>
      </div>
      </div>

      {/* Bottom controls */}
      <div className="mt-4 flex items-center gap-6">
        <button
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          style={{ color: genreColors.accent, opacity: 0.5, transition: "opacity 0.2s" }}
          className="hover:opacity-100 p-2"
          data-testid="button-prev-page"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-0.5">
          {Array.from({ length: Math.min(allPages.length, 30) }, (_, i) => {
            const step = allPages.length > 30 ? Math.floor(allPages.length / 30) : 1;
            const pageIdx = i * step;
            return (
              <button
                key={i}
                style={{
                  width: currentPage >= pageIdx && currentPage < pageIdx + step ? 12 : 4,
                  height: 4,
                  borderRadius: 2,
                  transition: "all 0.2s",
                  backgroundColor: currentPage >= pageIdx && currentPage < pageIdx + step
                    ? genreColors.accent
                    : "rgba(255,255,255,0.1)",
                  border: "none",
                  cursor: "pointer",
                  margin: "0 1px",
                }}
                onClick={() => goToPage(pageIdx)}
                data-testid={`dot-page-${i}`}
                aria-label={`Go to page ${pageIdx + 1}`}
              />
            );
          })}
        </div>

        <button
          onClick={() => bookRef.current?.pageFlip().flipNext()}
          style={{ color: genreColors.accent, opacity: 0.5, transition: "opacity 0.2s" }}
          className="hover:opacity-100 p-2"
          data-testid="button-next-page"
          aria-label="Next page"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-2 w-full max-w-lg px-4">
        <div style={{ height: 2, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 1, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              backgroundColor: genreColors.accent,
              opacity: 0.35,
              borderRadius: 1,
              transition: "width 0.3s",
              width: `${Math.round(((currentPage + 1) / allPages.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      <style>{`
        .book-flip-realistic {
          box-shadow: 0 10px 50px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3);
        }
        .book-flip-realistic .stf__item {
          background-color: ${PAGE_BG} !important;
        }
        .book-flip-realistic .stf__item > div {
          background-color: ${PAGE_BG} !important;
        }
        .book-flip-realistic .stf__block {
          background-color: ${PAGE_BG} !important;
        }
        .book-flip-realistic .stf__parent {
          background-color: transparent !important;
        }
        .book-flip-realistic .--left,
        .book-flip-realistic .--right {
          background-color: ${PAGE_BG} !important;
        }
      `}</style>

      {showFullText && draft && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            overflowY: "auto", padding: "40px 16px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFullText(false); }}
        >
          <div style={{
            backgroundColor: "#1a1814", color: "#e8dcc8",
            fontFamily: "Georgia, serif", maxWidth: 720, width: "100%",
            borderRadius: 8, padding: "40px 32px", position: "relative",
            boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
            lineHeight: 1.8, fontSize: 15,
          }}>
            <button
              onClick={() => setShowFullText(false)}
              style={{
                position: "sticky", top: 0, float: "right",
                background: "#3a3020", border: "none", color: "#d4a853",
                borderRadius: 4, padding: "4px 12px", cursor: "pointer",
                fontSize: 13, fontFamily: "sans-serif", marginBottom: 8,
              }}
            >✕ Close</button>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#d4a853", textAlign: "center", marginBottom: 8, fontSize: 24 }}>
              {draft.title}
            </h1>
            <p style={{ textAlign: "center", color: "#8a7a60", fontSize: 13, marginBottom: 32 }}>
              {draft.genre} &nbsp;·&nbsp; {wordCount.toLocaleString()} words &nbsp;·&nbsp; {chapters.length} chapters
            </p>
            {chapters.map((ch) => (
              <div key={ch.number} style={{ marginBottom: 32 }}>
                <h2 style={{ color: "#c4975a", borderBottom: "1px solid #3a3020", paddingBottom: 6, marginBottom: 16, fontSize: 17, fontFamily: "'Playfair Display', serif" }}>
                  Chapter {ch.number}: {ch.title}
                </h2>
                {ch.content
                  .replace(/\[ILLUSTRATION:[^\]]*\]/gi, "")
                  .replace(/\[IMAGE:[^\]]*\]/gi, "")
                  .split("\n")
                  .map((line, i) => {
                    const t = line.trim();
                    if (!t) return <div key={i} style={{ height: 8 }} />;
                    if (t.startsWith("## ") || t.startsWith("### ")) {
                      return <h3 key={i} style={{ color: "#c4975a", fontSize: 15, margin: "20px 0 8px", fontFamily: "'Playfair Display', serif" }}>{t.replace(/^#{2,}\s*/, "")}</h3>;
                    }
                    return <p key={i} style={{ margin: "10px 0", textIndent: 24, textAlign: "justify" }}>{t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")}</p>;
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
