import fs from "fs";
import path from "path";
import { LOST_COVER_REGEN_IDS, isLostCoverRegenDraft } from "@shared/coverConstants";
import { isCoverRegenDeferred, isCoverSatisfiedForWorkflow } from "@shared/coverMetadata";
import { uploadToObjStore, objStoreExists, getObjStoreBucketName } from "./objectStorage";

export { LOST_COVER_REGEN_IDS, isLostCoverRegenDraft };

const COVER_DIR = path.join(process.cwd(), "uploads", "covers");

function contentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/** True when running in Cursor/local dev without Replit object storage. */
export function isLocalWorkspaceMode(): boolean {
  return !getObjStoreBucketName();
}

export function coverFilenameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/(?:uploads|objstore)\/covers\/(.+)$/);
  return match ? match[1] : null;
}

export function toObjstoreCoverUrl(url: string): string {
  if (url.startsWith("/objstore/covers/")) return url;
  if (url.startsWith("/uploads/covers/")) {
    return url.replace("/uploads/covers/", "/objstore/covers/");
  }
  return url;
}

export function localCoverPath(filename: string): string {
  return path.join(COVER_DIR, filename);
}

/**
 * Write cover bytes to disk and (when available) object storage.
 * Local/Cursor: returns /uploads/covers/... so the file on disk is the source of truth.
 * Replit: returns /objstore/covers/... after a successful GCS upload.
 */
export async function saveCoverFile(buffer: Buffer, filename: string): Promise<string> {
  fs.mkdirSync(COVER_DIR, { recursive: true });
  const localPath = localCoverPath(filename);
  fs.writeFileSync(localPath, buffer);

  const uploadsUrl = `/uploads/covers/${filename}`;
  const gcsPath = `public/covers/${filename}`;
  const uploaded = await uploadToObjStore(buffer, gcsPath, contentTypeForFilename(filename));

  if (uploaded) {
    return `/objstore/covers/${filename}`;
  }

  if (isLocalWorkspaceMode()) {
    console.log(`[Covers] Saved locally (GCS not configured): ${uploadsUrl}`);
  } else {
    console.warn(`[Covers] GCS upload failed — keeping local copy at ${uploadsUrl}`);
  }
  return uploadsUrl;
}

/** Ensure a cover URL points at durable storage. Never returns null — preserves the original URL when the file is missing. */
export async function ensureCoverPersisted(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const filename = coverFilenameFromUrl(url);
  if (!filename) return url;

  const gcsPath = `public/covers/${filename}`;
  const objstoreUrl = `/objstore/covers/${filename}`;
  const uploadsUrl = `/uploads/covers/${filename}`;

  if (await objStoreExists(gcsPath)) {
    return objstoreUrl;
  }

  const localPath = localCoverPath(filename);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    const buffer = fs.readFileSync(localPath);
    const uploaded = await uploadToObjStore(buffer, gcsPath, contentTypeForFilename(filename));
    return uploaded ? objstoreUrl : uploadsUrl;
  }

  // File missing — keep the URL so we don't erase metadata; UI can still attempt recovery.
  return url;
}

/** Pick the best cover URL for UI display (draft → catalog → background). */
export function resolveDisplayCoverUrl(
  coverUrl: string | null | undefined,
  catalogCoverUrl: string | null | undefined,
  backgroundUrl?: string | null,
): string | null {
  const useObjstore = !!process.env.PUBLIC_OBJECT_SEARCH_PATHS?.trim();
  for (const raw of [coverUrl, catalogCoverUrl, backgroundUrl]) {
    if (!raw?.trim()) continue;
    if (useObjstore) return toObjstoreCoverUrl(raw);
    // Local dev: serve via /uploads/covers/ (production proxy fills missing files)
    if (raw.startsWith("/objstore/covers/")) {
      return raw.replace("/objstore/covers/", "/uploads/covers/");
    }
    return raw;
  }
  return null;
}

export function coverFileExistsLocally(url: string | null | undefined): boolean {
  const filename = coverFilenameFromUrl(url);
  if (!filename) return false;
  const localPath = localCoverPath(filename);
  return fs.existsSync(localPath) && fs.statSync(localPath).size > 0;
}

export type CoverReachabilityOpts = {
  /** Published drafts with stored cover URLs can be served via production proxy in local dev. */
  publishedAt?: Date | string | null;
  /** Production-recovered cover — regen deferred, URL still valid on ebookgamez.com */
  coverDeferred?: boolean;
};

/**
 * Fast sync check: does this draft have a cover the app can actually serve?
 * Local/Cursor: file on disk, or published/deferred URL (production proxy). Replit: trust /objstore/ (GCS).
 */
export function draftCoverLikelyReachable(
  coverUrl: string | null | undefined,
  backgroundUrl: string | null | undefined,
  opts?: CoverReachabilityOpts,
): boolean {
  if (coverFileExistsLocally(coverUrl) || coverFileExistsLocally(backgroundUrl)) {
    return true;
  }
  const primary = coverUrl || backgroundUrl || "";
  if (!primary) return false;
  if (!isLocalWorkspaceMode()) {
    return primary.startsWith("/objstore/covers/") || primary.startsWith("/uploads/covers/");
  }
  if ((opts?.publishedAt || opts?.coverDeferred) && primary.includes("/covers/")) {
    return true;
  }
  return false;
}

/** Async check including GCS — used at startup to quarantine broken covers. */
export async function draftCoverIsReachable(
  coverUrl: string | null | undefined,
  backgroundUrl: string | null | undefined,
  opts?: CoverReachabilityOpts,
): Promise<boolean> {
  if (draftCoverLikelyReachable(coverUrl, backgroundUrl, opts)) return true;
  for (const url of [coverUrl, backgroundUrl]) {
    if (!url?.trim()) continue;
    const filename = coverFilenameFromUrl(url);
    if (!filename) continue;
    if (await objStoreExists(`public/covers/${filename}`)) return true;
  }
  return false;
}

/** Pre-publish check — local/GCS file, or production-recovered cover marked deferred. */
export function draftHasPublishableCover(draft: {
  coverUrl?: string | null;
  backgroundUrl?: string | null;
  description?: string | null;
  publishedAt?: Date | string | null;
}): boolean {
  const url = draft.coverUrl || draft.backgroundUrl;
  if (!url?.trim()) return false;
  const deferred = isCoverSatisfiedForWorkflow(draft);
  return draftCoverLikelyReachable(draft.coverUrl, draft.backgroundUrl, {
    publishedAt: draft.publishedAt,
    coverDeferred: deferred,
  });
}

/** Draft lost its cover file in the known wipe — only these go to Awaiting for regen. */
export function draftNeedsCoverRegeneration(draft: {
  id: number;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
  coverStyleId?: string | null;
  publishedAt?: Date | string | null;
  description?: string | null;
}): boolean {
  if (isCoverRegenDeferred(draft)) return false;
  const deferred = isCoverSatisfiedForWorkflow(draft);
  if (draftCoverLikelyReachable(draft.coverUrl, draft.backgroundUrl, {
    publishedAt: draft.publishedAt,
    coverDeferred: deferred,
  })) {
    return false;
  }
  return LOST_COVER_REGEN_IDS.has(draft.id);
}

/** Cover Review API enrichment — keeps style id, flags missing files, no catalog ghost covers. */
export function enrichDraftForCoverReview<T extends {
  id: number;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
  coverStyleId?: string | null;
  publishedAt?: Date | string | null;
  description?: string | null;
}>(draft: T): T & { coverReachable: boolean; needsCoverRegeneration: boolean; coverRegenDeferred: boolean } {
  const deferred = isCoverRegenDeferred(draft);
  const reachOpts = { publishedAt: draft.publishedAt, coverDeferred: deferred };
  const coverReachable = draftCoverLikelyReachable(draft.coverUrl, draft.backgroundUrl, reachOpts);
  const needsCoverRegeneration = draftNeedsCoverRegeneration(draft);
  const displayCover = coverReachable
    ? resolveDisplayCoverUrl(draft.coverUrl, null, draft.backgroundUrl)
    : null;
  return {
    ...draft,
    coverUrl: displayCover,
    backgroundUrl: coverReachable ? draft.backgroundUrl ?? null : null,
    coverReachable,
    needsCoverRegeneration,
    coverRegenDeferred: deferred,
  };
}

/** Strip broken cover metadata so UI shows draft in the "needs cover" queue. */
export function quarantineBrokenCoverFields<T extends {
  coverUrl?: string | null;
  backgroundUrl?: string | null;
  coverStyleId?: string | null;
  overlayApproved?: boolean;
}>(draft: T): T & { coverReachable: boolean } {
  const hasUrl = !!(draft.coverUrl || draft.backgroundUrl);
  if (!hasUrl) {
    return { ...draft, coverReachable: false };
  }
  if (draftCoverLikelyReachable(draft.coverUrl, draft.backgroundUrl, { publishedAt: (draft as { publishedAt?: Date | string | null }).publishedAt })) {
    return { ...draft, coverReachable: true };
  }
  return {
    ...draft,
    coverUrl: null,
    backgroundUrl: null,
    overlayApproved: false,
    coverReachable: false,
  };
}

/** Read cover bytes from local disk, GCS, or production fallback — for push-to-production. */
export async function readCoverBytesForSync(
  url: string | null | undefined,
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!url?.trim()) return null;
  const filename = coverFilenameFromUrl(url);
  if (!filename) return null;

  const localPath = localCoverPath(filename);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    return { buffer: fs.readFileSync(localPath), filename };
  }

  const { downloadBufferFromObjStore } = await import("./objectStorage");
  const fromGcs = await downloadBufferFromObjStore(url);
  if (fromGcs && fromGcs.length > 0) {
    return { buffer: fromGcs, filename };
  }

  const { fetchCoverFromProduction } = await import("./coverProxy");
  const fromProd = await fetchCoverFromProduction(filename, false);
  if (fromProd && fromProd.length > 0) {
    return { buffer: fromProd, filename };
  }

  return null;
}
