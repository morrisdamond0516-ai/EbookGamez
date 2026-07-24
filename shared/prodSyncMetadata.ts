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
 * Important: missing ---PROD_SYNC--- does NOT mean the book is offline.
 * Older publishes never wrote a stamp. If the book is already in the local
 * storefront catalog, treat it as done (`on_storefront`) unless a title repair
 * is awaiting push or a stamp exists and the fingerprint drifted.
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
    /** True when a catalog/storefront row already exists for this draft. */
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
  const inCatalog = options?.inCatalog === true;

  if (isTitleRepairAwaitingProdPush(draft)) {
    return {
      needsProdPush: true,
      reason: "title_repair",
      lastSyncedAt: stored?.syncedAt ?? null,
      fingerprint: current,
    };
  }

  if (!stored) {
    // Already on the storefront catalog = work is done (legacy, no stamp).
    if (inCatalog) {
      return {
        needsProdPush: false,
        reason: "on_storefront",
        lastSyncedAt: null,
        fingerprint: current,
      };
    }
    // Published locally but not in catalog → actually needs a push/publish.
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
