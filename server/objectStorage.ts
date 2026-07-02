import * as fs from "fs";
import { Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";

function makeStorageCreds() {
  return {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as any;
}

// Single shared GCS client — created once, reused for every serve/upload request.
// Creating a new Storage() per-request was exhausting the connection pool.
let _sharedClient: Storage | null = null;
export function getSharedStorageClient(): Storage {
  if (!_sharedClient) {
    _sharedClient = new Storage({ credentials: makeStorageCreds(), projectId: "" });
  }
  return _sharedClient;
}

/** Force the shared client to be recreated on next use. Call after auth failures. */
export function resetSharedStorageClient(): void {
  _sharedClient = null;
}

export function getObjStoreBucketName(): string | null {
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  return publicPaths.split(",").filter(s => s.trim())[0]?.split("/")[1] || null;
}

/** Retry helper — retries up to maxAttempts on socket/network errors */
async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isRetryable = err.message?.includes("socket hang up") ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("Authentication timed out") ||
        err.message?.includes("socket disconnected");
      if (!isRetryable || attempt === maxAttempts) throw err;
      const delay = 1000 * attempt;
      console.warn(`[ObjStore] Attempt ${attempt}/${maxAttempts} failed for ${label}: ${err.message} — retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Upload a buffer to object storage with retry. Returns true on success. */
export async function uploadToObjStore(
  buffer: Buffer,
  remotePath: string,
  contentType = "image/png"
): Promise<boolean> {
  try {
    const bucketName = getObjStoreBucketName();
    if (!bucketName) return false;
    const client = getSharedStorageClient();
    const file = client.bucket(bucketName).file(remotePath);
    const [exists] = await withRetry(() => file.exists(), remotePath);
    if (!exists) {
      await withRetry(() => file.save(buffer, { contentType, resumable: false }), remotePath);
    }
    return true;
  } catch (err: any) {
    console.error(`[ObjStore] Upload failed after retries for ${remotePath}:`, err.message);
    return false;
  }
}

/** Upload a local file path to object storage. Returns true on success. */
export async function uploadFileToObjStore(
  localPath: string,
  remotePath: string,
  contentType = "image/png"
): Promise<boolean> {
  try {
    if (!fs.existsSync(localPath)) return false;
    const buffer = fs.readFileSync(localPath);
    return uploadToObjStore(buffer, remotePath, contentType);
  } catch (err: any) {
    console.error(`[ObjStore] File upload failed for ${remotePath}:`, err.message);
    return false;
  }
}

/** Check if a file exists in object storage. */
export async function objStoreExists(remotePath: string): Promise<boolean> {
  try {
    const bucketName = getObjStoreBucketName();
    if (!bucketName) return false;
    const client = getSharedStorageClient();
    const [exists] = await withRetry(() => client.bucket(bucketName).file(remotePath).exists(), remotePath);
    return exists;
  } catch { return false; }
}

/** Create a read stream from object storage. Returns null if not found. */
export async function createObjStoreReadStream(remotePath: string): Promise<NodeJS.ReadableStream | null> {
  try {
    const bucketName = getObjStoreBucketName();
    if (!bucketName) return null;
    const client = getSharedStorageClient();
    const file = client.bucket(bucketName).file(remotePath);
    const [exists] = await withRetry(() => file.exists(), remotePath);
    if (!exists) return null;
    return file.createReadStream();
  } catch { return null; }
}

/**
 * Download a file from object storage and return it as a Buffer.
 * Accepts either a GCS remote path (e.g. "public/covers/foo.png")
 * or an /objstore/ URL (e.g. "/objstore/covers/foo.png" or "/objstore/illustrations/bar.png").
 * Returns null if the file is not found or on error.
 */
export async function downloadBufferFromObjStore(remotePathOrUrl: string): Promise<Buffer | null> {
  try {
    const bucketName = getObjStoreBucketName();
    if (!bucketName) return null;
    const client = getSharedStorageClient();

    // Convert /objstore/<segment>/<filename> URL to the GCS path public/<segment>/<filename>
    let gcsPath = remotePathOrUrl;
    const objstoreMatch = remotePathOrUrl.match(/^\/objstore\/(.+)$/);
    if (objstoreMatch) {
      gcsPath = `public/${objstoreMatch[1]}`;
    }

    const file = client.bucket(bucketName).file(gcsPath);
    const [exists] = await withRetry(() => file.exists(), gcsPath);
    if (!exists) return null;
    const [buf] = await withRetry(() => file.download(), gcsPath);
    return buf as Buffer;
  } catch (err: any) {
    console.error(`[ObjStore] Download failed for ${remotePathOrUrl}:`, err.message);
    return null;
  }
}
