/**
 * Tracks title renames so Push to Production can find the live draft/catalog
 * after local titles change (dev/prod draft IDs collide and exact-title sync fails).
 * Stored in draft.description (stripped before storefront catalog descriptions).
 */

export type TitleRepairMeta = {
  /** Titles this draft previously used (oldest → newest before current). */
  previousTitles: string[];
  repairedAt?: string;
};

const BLOCK_START = "---TITLE_REPAIR---";
const BLOCK_END = "---END_TITLE_REPAIR---";

export function parseTitleRepairFromDescription(
  description: string | null | undefined,
): TitleRepairMeta | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${BLOCK_START}\\s*([\\s\\S]*?)\\s*${BLOCK_END}`),
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as TitleRepairMeta;
    if (Array.isArray(parsed?.previousTitles) && parsed.previousTitles.length > 0) {
      return {
        previousTitles: parsed.previousTitles
          .map((t) => String(t || "").trim())
          .filter((t) => t.length >= 2),
        repairedAt: parsed.repairedAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function stripTitleRepairFromDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\s*`, "g"), "")
    .trim();
}

export function withTitleRepairInDescription(
  description: string | null | undefined,
  meta: TitleRepairMeta,
): string {
  const base = stripTitleRepairFromDescription(description);
  const previousTitles = [...new Set(meta.previousTitles.map((t) => t.trim()).filter(Boolean))];
  if (previousTitles.length === 0) return base;
  const block = `${BLOCK_START}\n${JSON.stringify({
    previousTitles,
    repairedAt: meta.repairedAt || new Date().toISOString(),
  })}\n${BLOCK_END}`;
  return base ? `${base}\n\n${block}` : block;
}

/** Append a newly replaced title to the repair history (keeps order, dedupes). */
export function recordPreviousTitleInDescription(
  description: string | null | undefined,
  previousTitle: string,
): string {
  const title = previousTitle.trim();
  if (!title) return description || "";
  const existing = parseTitleRepairFromDescription(description);
  const previousTitles = [...(existing?.previousTitles || [])];
  if (!previousTitles.some((t) => t.toLowerCase() === title.toLowerCase())) {
    previousTitles.push(title);
  }
  return withTitleRepairInDescription(description, {
    previousTitles,
    repairedAt: new Date().toISOString(),
  });
}

export function getPreviousTitlesFromDescription(
  description: string | null | undefined,
): string[] {
  return parseTitleRepairFromDescription(description)?.previousTitles || [];
}
