/**
 * Illustration helpers for push-to-production (mirror cover sync).
 */
import fs from "fs";
import path from "path";

const ILLUST_DIR = path.join(process.cwd(), "uploads", "illustrations");

export function toObjstoreIllustrationUrl(url: string): string {
  if (url.startsWith("/objstore/illustrations/")) return url;
  if (url.startsWith("/uploads/illustrations/")) {
    return url.replace("/uploads/illustrations/", "/objstore/illustrations/");
  }
  return url;
}

export function rewriteContentIllustrationUrls(content: string): string {
  if (!content) return content;
  return content.replace(/\/uploads\/illustrations\//g, "/objstore/illustrations/");
}

/** Unique illustration filenames referenced in draft content. */
export function extractIllustrationFilenames(content: string | null | undefined): string[] {
  if (!content) return [];
  const names = new Set<string>();
  for (const m of content.matchAll(
    /\/(?:uploads|objstore)\/illustrations\/(illust-[^\s|"\]]+\.(?:png|jpe?g|webp))/gi,
  )) {
    names.add(m[1]);
  }
  return [...names];
}

export function localIllustrationPath(filename: string): string {
  return path.join(ILLUST_DIR, filename);
}

/**
 * Save illustration bytes locally and to object storage when available.
 * Returns the durable URL to use in content (/objstore preferred).
 */
export async function saveIllustrationFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  fs.mkdirSync(ILLUST_DIR, { recursive: true });
  const localPath = localIllustrationPath(safeName);
  fs.writeFileSync(localPath, buffer);

  const uploadsUrl = `/uploads/illustrations/${safeName}`;
  try {
    const { uploadToObjStore } = await import("./objectStorage");
    const uploaded = await uploadToObjStore(
      buffer,
      `public/illustrations/${safeName}`,
      "image/png",
    );
    if (uploaded) return `/objstore/illustrations/${safeName}`;
  } catch (err: any) {
    console.warn(`[IllustSync] GCS upload failed for ${safeName}: ${err.message}`);
  }
  return uploadsUrl;
}

/** Read illustration bytes from local disk or GCS — for push-to-production. */
export async function readIllustrationBytesForSync(
  filename: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName) return null;

  const localPath = localIllustrationPath(safeName);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 500) {
    return { buffer: fs.readFileSync(localPath), filename: safeName };
  }

  try {
    const { downloadBufferFromObjStore } = await import("./objectStorage");
    const fromGcs = await downloadBufferFromObjStore(`/objstore/illustrations/${safeName}`);
    if (fromGcs && fromGcs.length > 500) {
      return { buffer: fromGcs, filename: safeName };
    }
  } catch {
    /* ignore */
  }

  return null;
}
