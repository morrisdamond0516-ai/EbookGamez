import fs from "fs";
import path from "path";
import { uploadToObjStore, objStoreExists } from "./objectStorage";

const COVER_DIR = path.join(process.cwd(), "uploads", "covers");

function contentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
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

/** Write cover bytes to disk and object storage; returns canonical /objstore/covers/ URL. */
export async function saveCoverFile(buffer: Buffer, filename: string): Promise<string> {
  fs.mkdirSync(COVER_DIR, { recursive: true });
  const localPath = localCoverPath(filename);
  fs.writeFileSync(localPath, buffer);
  await uploadToObjStore(buffer, `public/covers/${filename}`, contentTypeForFilename(filename));
  return `/objstore/covers/${filename}`;
}

/** Ensure a cover URL points at object storage when the file is available locally or in GCS. */
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

  return null;
}

/** Pick the best cover URL for UI display (draft → background → catalog → similar draft). */
export function resolveDisplayCoverUrl(
  coverUrl: string | null | undefined,
  backgroundUrl: string | null | undefined,
  bookCoverUrl?: string | null,
  similarDraftCoverUrl?: string | null,
): string | null {
  const useObjstore = !!process.env.PUBLIC_OBJECT_SEARCH_PATHS?.trim();
  for (const raw of [coverUrl, backgroundUrl, bookCoverUrl, similarDraftCoverUrl]) {
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
