/**
 * Deferred quality notes — books that failed a structural gate but stay published.
 * Stored in draft.description (hidden from catalog). Does NOT demote or unpublish.
 */
export type QualityDeferralMeta = {
  /** Why deferred — e.g. missing_illustrations */
  reason: string;
  /** Short human note for Content Studio */
  note: string;
  /** ISO timestamp when tagged */
  taggedAt: string;
  /** Structural gate issue samples (capped) */
  issues?: string[];
};

const BLOCK_START = "---QUALITY_DEFERRAL---";
const BLOCK_END = "---END_QUALITY_DEFERRAL---";

export function parseQualityDeferralFromDescription(
  description: string | null | undefined,
): QualityDeferralMeta | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${BLOCK_START}\\s*([\\s\\S]*?)\\s*${BLOCK_END}`),
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as QualityDeferralMeta;
    if (parsed?.reason && parsed?.taggedAt) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function stripQualityDeferralFromDescription(
  description: string | null | undefined,
): string {
  if (!description) return "";
  return description
    .replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\s*`, "g"), "")
    .trim();
}

export function withQualityDeferralInDescription(
  description: string | null | undefined,
  meta: QualityDeferralMeta,
): string {
  const base = stripQualityDeferralFromDescription(description);
  const block = `${BLOCK_START}\n${JSON.stringify(meta)}\n${BLOCK_END}`;
  return base ? `${base}\n\n${block}` : block;
}

export function draftHasQualityDeferral(draft: {
  description?: string | null;
}): boolean {
  return !!parseQualityDeferralFromDescription(draft.description);
}
