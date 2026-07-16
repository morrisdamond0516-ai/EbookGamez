/**
 * Tracks when a draft was last pushed to live production and whether local edits
 * changed content/covers since that push. Stored in draft.description (non-catalog).
 */

/** Max books per production push batch (auto-queue uses this size repeatedly). */
export const PROD_PUSH_BATCH_SIZE = 20;
import crypto from "crypto";

export type ProdSyncMeta = {
  fingerprint: string;
  syncedAt: string;
  productionUrl?: string;
};

const BLOCK_START = "---PROD_SYNC---";
const BLOCK_END = "---END_PROD_SYNC---";

export function computeDraftProdFingerprint(draft: {
  content?: string | null;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
}): string {
  const payload = `${draft.content || ""}|${draft.coverUrl || ""}|${draft.backgroundUrl || ""}`;
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

export type ProdSyncStatus = {
  needsProdPush: boolean;
  reason: "never_pushed" | "local_changes" | "synced" | "not_published";
  lastSyncedAt: string | null;
  fingerprint: string | null;
};

export function assessProdSyncStatus(
  draft: {
    status?: string | null;
    content?: string | null;
    coverUrl?: string | null;
    backgroundUrl?: string | null;
    description?: string | null;
  },
  options?: { currentFingerprint?: string },
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
  if (!stored) {
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
