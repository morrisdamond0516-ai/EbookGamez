/**
 * Pagination helpers — keep step markers, bullets, labels, and headers with
 * at least the first line of content that follows (avoid orphan leaders at page breaks).
 */
import { isWorksheetSectionHeader } from "./activityBookContent";
import {
  isInstructionalSectionHeader,
  getInstructionalSectionKind,
} from "./educationalBookQuality";

/** Minimum follower visual lines to reserve below a leader line. */
export const PAGINATION_MIN_FOLLOWER_LINES = 2;

/** How many body items an instructional section should keep with its header on the same page. */
export const INSTRUCTIONAL_SECTION_MIN_FOLLOWERS = 2;

export function isPaginationLeaderLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):/i.test(trimmed)) return false;

  if (/^#{1,6}\s/.test(trimmed)) return true;

  // Standalone step number: "2." or "2"
  if (/^\d+\.?\s*$/.test(trimmed)) return true;

  // Bold-only step / section title: **Step 1:** or **Exercise**
  if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(trimmed)) return true;

  const plain = trimmed.replace(/^#{1,6}\s+/, "").replace(/\*+/g, "").trim();
  if (isWorksheetSectionHeader(plain)) return true;
  if (isInstructionalSectionHeader(trimmed) || isInstructionalSectionHeader(plain)) return true;

  const unbullet = trimmed.replace(/^[-•]\s+/, "");
  // Label ending with colon: "Clue:", "- Date:", "**Notes:**"
  if (/^(\*{0,2})[A-Za-z][^:]{0,48}(\*{0,2})\s*:\s*$/.test(unbullet)) return true;

  const bulletBody = trimmed.match(/^[-•]\s+(.+)$/);
  if (bulletBody) {
    const body = bulletBody[1].trim();
    if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(body)) return true;
    if (/^[A-Za-z][^:]{0,40}:\s*$/.test(body.replace(/\*+/g, ""))) return true;
  }

  return false;
}

/** Leaders whose meaning depends on the next line(s) — not self-contained numbered bullets. */
export function paginationLeaderNeedsFollower(trimmed: string): boolean {
  if (!isPaginationLeaderLine(trimmed)) return false;
  if (/^\d+\.\s+\S/.test(trimmed)) return false;
  return true;
}

export function findNextSubstantiveLineIndex(lines: string[], fromIndex: number): number {
  for (let j = fromIndex + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (t === "" || t === "---") continue;
    return j;
  }
  return -1;
}

function isSectionBoundaryLine(trimmed: string): boolean {
  if (!trimmed || trimmed === "---") return true;
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(trimmed) && isInstructionalSectionHeader(trimmed)) return true;
  return false;
}

/**
 * Count substantive body items under a section header until the next section/chapter boundary.
 * Numbered items, bullets, and paragraphs each count as one item.
 */
export function countInstructionalSectionItems(lines: string[], headerIndex: number): number {
  let count = 0;
  for (let j = headerIndex + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (t === "---") break;
    if (/^#{1,2}\s*\**\s*Chapter\s+\d+/i.test(t)) break;
    // Next instructional / markdown section ends this block
    if (j > headerIndex + 1 && (isInstructionalSectionHeader(t) || /^#{2,}\s/.test(t))) break;
    count++;
    if (count >= 8) break;
  }
  return count;
}

/**
 * How many follower items must stay with this line on the same page.
 * Instructional chrome (Objectives / Example / Practice): min(2, available items), at least 1 if any exist.
 */
export function requiredFollowerItemsForLeader(lines: string[], lineIndex: number): number {
  const trimmed = lines[lineIndex]?.trim() || "";
  if (!paginationLeaderNeedsFollower(trimmed)) return 0;
  if (isInstructionalSectionHeader(trimmed) || getInstructionalSectionKind(trimmed)) {
    const available = countInstructionalSectionItems(lines, lineIndex);
    if (available <= 0) return 0;
    if (available === 1) return 1;
    return Math.min(INSTRUCTIONAL_SECTION_MIN_FOLLOWERS, available);
  }
  return 1;
}

/** Collect line indices of the next N substantive followers after fromIndex. */
export function collectFollowerLineIndices(
  lines: string[],
  fromIndex: number,
  needed: number,
): number[] {
  const out: number[] = [];
  for (let j = fromIndex + 1; j < lines.length && out.length < needed; j++) {
    const t = lines[j].trim();
    if (!t || t === "---") continue;
    out.push(j);
  }
  return out;
}

/** True if the last non-empty line on a page is a leader that still needs followers. */
export function pageEndsWithOrphanLeader(page: string[]): boolean {
  for (let i = page.length - 1; i >= 0; i--) {
    const t = page[i].trim();
    if (!t) continue;
    return paginationLeaderNeedsFollower(t);
  }
  return false;
}
