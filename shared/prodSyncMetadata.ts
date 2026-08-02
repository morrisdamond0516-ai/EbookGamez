/**
 * Tracks when a draft was last pushed to live production and whether local edits
 * changed content/covers/title since that push. Stored in draft.description (non-catalog).
 */

/** Max books per production push batch (auto-queue uses this size repeatedly). */
export const PROD_PUSH_BATCH_SIZE = 20;
import crypto from "crypto";
import { parseTitleRepairFromDescription } from "./titleRepairMetadata";

export type ProdSyncMeta = {
  fingerprint: string;
  syncedAt: string;
  productionUrl?: string;
};

const BLOCK_START = "---PROD_SYNC---";
const BLOCK_END = "---END_PROD_SYNC---";

export function computeDraftProdFingerprint(draft: {
  title?: string | null;
  content?: string | null;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
}): string {
  const payload = `${draft.title || ""}|${draft.content || ""}|${draft.coverUrl || ""}|${draft.backgroundUrl || ""}`;
  return crypto.createHash("md5").update(payload).digest("hex");
}

export function parseProdSyncFromDescription(
  description: string | null | undefined,
): ProdSyncMeta | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${BLOCK_START}\\s*([\\s\\S]*?)\\s*${BLOCK_END}`),
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as ProdSyncMeta;
    if (parsed?.fingerprint && parsed?.syncedAt) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function stripProdSyncFromDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\s*`, "g"), "")
    .trim();
}

export function withProdSyncInDescription(
  description: string | null | undefined,
  meta: ProdSyncMeta,
): string {
  const base = stripProdSyncFromDescription(description);
  const block = `${BLOCK_START}\n${JSON.stringify(meta)}\n${BLOCK_END}`;
  return base ? `${base}\n\n${block}` : block;
}

export type ProdSyncReason =
  | "never_pushed"
  | "local_changes"
  | "title_repair"
  | "synced"
  | "on_storefront"
  | "not_published";

export type ProdSyncStatus = {
  needsProdPush: boolean;
  reason: ProdSyncReason;
  lastSyncedAt: string | null;
  fingerprint: string | null;
};

/** True when TITLE_REPAIR.repairedAt is after the last successful prod sync (or never synced). */
export function isTitleRepairAwaitingProdPush(draft: {
  description?: string | null;
}): boolean {
  const repair = parseTitleRepairFromDescription(draft.description);
  if (!repair?.previousTitles?.length) return false;
  const repairedMs = repair.repairedAt ? Date.parse(repair.repairedAt) : NaN;
  const stored = parseProdSyncFromDescription(draft.description);
  if (!stored?.syncedAt) return true;
  const syncedMs = Date.parse(stored.syncedAt);
  if (!Number.isFinite(syncedMs)) return true;
  if (!Number.isFinite(repairedMs)) return true;
  return repairedMs > syncedMs;
}

/**
 * Decide whether a published draft still needs Push to Production.
 *
 * Source of truth is the ---PROD_SYNC--- stamp written only after a successful
 * push to live (ebookgamez.com / EbookGamez.replit.app).
 *
 * Local storefront catalog (`inCatalog`) is NOT the same as live production.
 * A book can be published locally and still need a push. Legacy books that were
 * already live were backfilled with stamps via script/backfill-prod-sync-stamps.ts.
 */
export function assessProdSyncStatus(
  draft: {
    status?: string | null;
    title?: string | null;
    content?: string | null;
    coverUrl?: string | null;
    backgroundUrl?: string | null;
    description?: string | null;
  },
  options?: {
    currentFingerprint?: string;
    /** @deprecated Kept for call-site compatibility; no longer suppresses need-push. */
    inCatalog?: boolean;
  },
): ProdSyncStatus {
  if (draft.status !== "published") {
    return {
      needsProdPush: false,
      reason: "not_published",
      lastSyncedAt: null,
      fingerprint: null,
    };
  }
  const current =
    options?.currentFingerprint ?? computeDraftProdFingerprint(draft);
  const stored = parseProdSyncFromDescription(draft.description);

  if (isTitleRepairAwaitingProdPush(draft)) {
    // Title repair happened after the last prod sync — must push regardless of
    // whether the book is already in the catalog. The catalog entry is stale
    // (holds the old title); being in catalog doesn't confirm the rename landed.
    return {
      needsProdPush: true,
      reason: "title_repair",
      lastSyncedAt: stored?.syncedAt ?? null,
      fingerprint: current,
    };
  }

  if (!stored) {
    // No successful push stamp → must push to live (even if local catalog exists).
    return {
      needsProdPush: true,
      reason: "never_pushed",
      lastSyncedAt: null,
      fingerprint: current,
    };
  }
  if (stored.fingerprint !== current) {
    return {
      needsProdPush: true,
      reason: "local_changes",
      lastSyncedAt: stored.syncedAt,
      fingerprint: current,
    };
  }
  return {
    needsProdPush: false,
    reason: "synced",
    lastSyncedAt: stored.syncedAt,
    fingerprint: current,
  };
}
