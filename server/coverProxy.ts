import fs from "fs";
import path from "path";
import type { Response } from "express";
import { getObjStoreBucketName } from "./objectStorage";
import { localCoverPath } from "./coverStorage";

const PRODUCTION_BASE = process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";
const COVER_DIR = path.join(process.cwd(), "uploads", "covers");

function contentTypeForPath(coverPath: string): string {
  const ext = coverPath.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/** Fetch a cover image from production and optionally cache it locally. */
export async function fetchCoverFromProduction(coverPath: string, cacheLocally = true): Promise<Buffer | null> {
  const encoded = coverPath.split("/").map(encodeURIComponent).join("/");
  const urls = [
    `${PRODUCTION_BASE}/objstore/covers/${encoded}`,
    `${PRODUCTION_BASE}/uploads/covers/${encoded}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) continue;

      if (cacheLocally) {
        const dest = localCoverPath(coverPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buffer);
      }
      return buffer;
    } catch {
      // try next URL
    }
  }
  return null;
}

/** Serve a cover file, falling back to production when missing locally and GCS is unavailable. */
export async function serveCoverWithFallback(coverPath: string, res: Response): Promise<boolean> {
  if (!coverPath) return false;

  const localPath = localCoverPath(coverPath);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    res.set({
      "Content-Type": contentTypeForPath(coverPath),
      "Cache-Control": "public, max-age=86400",
      "X-Cover-Source": "local",
    });
    fs.createReadStream(localPath).pipe(res);
    return true;
  }

  // In production, GCS handles missing local files via separate middleware.
  // In local dev (no GCS), pull from the live site and cache.
  if (!getObjStoreBucketName()) {
    const buffer = await fetchCoverFromProduction(coverPath, true);
    if (buffer) {
      res.set({
        "Content-Type": contentTypeForPath(coverPath),
        "Cache-Control": "public, max-age=86400",
        "X-Cover-Source": "production-fallback",
      });
      res.send(buffer);
      return true;
    }
  }

  return false;
}

export function isCloudStorageConfigured(): boolean {
  return !!getObjStoreBucketName();
}
