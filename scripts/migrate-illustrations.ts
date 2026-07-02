/**
 * One-shot illustration migration: uploads all /uploads/illustrations/ files
 * to Replit Object Storage and rewrites draft_ebooks.content paths.
 * Run with: npx tsx scripts/migrate-illustrations.ts
 */
import * as fs from "fs";
import * as path from "path";
import pg from "pg";
import { Storage } from "@google-cloud/storage";

const CONCURRENCY = 15;
const LOCAL_DIR = path.join(process.cwd(), "uploads", "illustrations");

function getBucketName(): string {
  // Uses same logic as server/objectStorage.ts getObjStoreBucketName()
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const name = publicPaths.split(",").filter(s => s.trim())[0]?.split("/")[1] || null;
  if (name) return name;
  throw new Error("Cannot determine bucket name from PUBLIC_OBJECT_SEARCH_PATHS: " + publicPaths);
}

async function runInBatches<T>(items: T[], fn: (item: T) => Promise<void>, concurrency: number) {
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      done++;
      if (done % 100 === 0) console.log(`  Progress: ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  const bucketName = getBucketName();
  console.log(`Bucket: ${bucketName}`);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Fetch all drafts with local illustration paths
  const { rows } = await client.query(
    "SELECT id, content FROM draft_ebooks WHERE content LIKE '%/uploads/illustrations/%'"
  );
  console.log(`Found ${rows.length} draft_ebooks with local illustration paths`);

  // Build filename → draftId map
  const fileToIds: Record<string, number[]> = {};
  for (const row of rows) {
    const matches = [...(row.content as string).matchAll(/\/uploads\/illustrations\/(illust-[^\s|"\]]+\.png)/g)];
    for (const m of matches) {
      const fname = m[1];
      if (!fileToIds[fname]) fileToIds[fname] = [];
      if (!fileToIds[fname].includes(row.id)) fileToIds[fname].push(row.id);
    }
  }

  const allFiles = Object.keys(fileToIds);
  console.log(`Found ${allFiles.length} unique illustration files to migrate`);
  if (allFiles.length === 0) { console.log("Nothing to do."); await client.end(); return; }

  const storageClient = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: "http://127.0.0.1:1106/token",
      type: "external_account",
      credential_source: {
        url: "http://127.0.0.1:1106/credential",
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    } as any,
    projectId: "",
  });
  const bucket = storageClient.bucket(bucketName);

  // Content cache — we'll apply all replacements and do one UPDATE per draft at the end
  const contentCache: Record<number, string> = {};
  for (const row of rows) contentCache[row.id] = row.content as string;

  let uploaded = 0, alreadyInCloud = 0, missingLocally = 0, errors = 0;

  await runInBatches(allFiles, async (fname) => {
    const localPath = path.join(LOCAL_DIR, fname);
    const remotePath = `public/illustrations/${fname}`;
    const localUrl = `/uploads/illustrations/${fname}`;
    const objUrl = `/objstore/illustrations/${fname}`;

    if (!fs.existsSync(localPath)) { missingLocally++; return; }

    try {
      const file = bucket.file(remotePath);
      const [exists] = await file.exists();
      if (!exists) {
        const buf = fs.readFileSync(localPath);
        await file.save(buf, { contentType: "image/png", resumable: false });
        uploaded++;
      } else {
        alreadyInCloud++;
      }
      // Update the in-memory content for each draft that references this file
      for (const id of fileToIds[fname]) {
        if (contentCache[id]) {
          contentCache[id] = contentCache[id].replaceAll(localUrl, objUrl);
        }
      }
    } catch (e: any) {
      errors++;
      console.error(`  ERROR ${fname}: ${e.message}`);
    }
  }, CONCURRENCY);

  console.log(`\nUpload complete: ${uploaded} uploaded, ${alreadyInCloud} already existed, ${missingLocally} missing locally, ${errors} errors`);
  console.log("Writing updated paths to database...");

  // Batch DB updates
  const draftIds = Object.keys(contentCache).map(Number);
  let updated = 0;
  for (const id of draftIds) {
    const original = rows.find(r => r.id === id)?.content;
    if (contentCache[id] !== original) {
      await client.query("UPDATE draft_ebooks SET content = $1 WHERE id = $2", [contentCache[id], id]);
      updated++;
    }
  }

  console.log(`Updated ${updated} draft_ebooks rows in database`);
  console.log("Migration complete!");
  await client.end();
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
