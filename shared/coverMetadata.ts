/**
 * Cover recovery metadata stored in draft.description (non-destructive, hidden from catalog).
 * Marks books that already have production/catalog covers — regen deferred until later.
 */
export type CoverRecoverySource = "production" | "catalog" | "local" | "draft-peer" | "manual";

export type CoverDeferredMeta = {
  source: CoverRecoverySource;
  coverUrl: string;
  backgroundUrl?: string | null;
  recoveredAt: string;
  deferRegen: true;
  note?: string;
};

const BLOCK_START = "---COVER_DEFERRED---";
const BLOCK_END = "---END_COVER_DEFERRED---";

export function parseCoverDeferredFromDescription(
  description: string | null | undefined,
): CoverDeferredMeta | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${BLOCK_START}\\s*([\\s\\S]*?)\\s*${BLOCK_END}`),
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as CoverDeferredMeta;
    if (parsed?.deferRegen && parsed.coverUrl) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function stripCoverDeferredFromDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\s*`, "g"), "")
    .trim();
}

export function withCoverDeferredInDescription(
  description: string | null | undefined,
  meta: CoverDeferredMeta,
): string {
  const base = stripCoverDeferredFromDescription(description);
  const block = `${BLOCK_START}\n${JSON.stringify(meta)}\n${BLOCK_END}`;
  return base ? `${base}\n\n${block}` : block;
}

export function isCoverRegenDeferred(draft: {
  description?: string | null;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
}): boolean {
  const meta = parseCoverDeferredFromDescription(draft.description);
  if (!meta?.deferRegen) return false;
  const url = draft.coverUrl || draft.backgroundUrl || meta.coverUrl;
  return !!url?.trim();
}

/** Existing cover is good enough for workflow — regen queued for later only. */
export function isCoverSatisfiedForWorkflow(draft: {
  description?: string | null;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
}): boolean {
  return isCoverRegenDeferred(draft);
}
