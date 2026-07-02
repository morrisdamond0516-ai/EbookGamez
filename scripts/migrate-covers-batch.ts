import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const COVERS_DIR = "./uploads/covers";
const DEST_PREFIX = "public/covers";
const PROGRESS_FILE = "/tmp/cover-migration-progress.json";
const BATCH_SIZE = 50;
const CONCURRENT = 5;

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const bucket = storage.bucket(BUCKET_ID);

function loadProgress(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    return new Set(data.uploaded || []);
  } catch {
    return new Set();
  }
}

function saveProgress(uploaded: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ uploaded: [...uploaded] }));
}

async function uploadFile(localPath: string, fileName: string): Promise<boolean> {
  try {
    const destPath = `${DEST_PREFIX}/${fileName}`;
    await bucket.upload(localPath, {
      destination: destPath,
      metadata: {
        contentType: fileName.endsWith(".png") ? "image/png" : fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream",
        cacheControl: "public, max-age=31536000",
      },
    });
    return true;
  } catch (err: any) {
    console.error(`  FAIL: ${fileName} - ${err.message?.slice(0, 80)}`);
    return false;
  }
}

async function main() {
  const allFiles = fs.readdirSync(COVERS_DIR).filter(f =>
    f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg")
  );

  const done = loadProgress();
  const remaining = allFiles.filter(f => !done.has(f));

  console.log(`Total covers: ${allFiles.length} | Already uploaded: ${done.size} | Remaining: ${remaining.length}`);

  if (remaining.length === 0) {
    console.log("All covers already migrated!");
    return;
  }

  const batch = remaining.slice(0, BATCH_SIZE);
  console.log(`Uploading batch of ${batch.length}...`);

  let success = 0;
  let fail = 0;

  for (let i = 0; i < batch.length; i += CONCURRENT) {
    const chunk = batch.slice(i, i + CONCURRENT);
    const results = await Promise.all(
      chunk.map(f => uploadFile(path.join(COVERS_DIR, f), f))
    );
    for (let j = 0; j < chunk.length; j++) {
      if (results[j]) {
        done.add(chunk[j]);
        success++;
      } else {
        fail++;
      }
    }
    saveProgress(done);
    process.stdout.write(`  ${i + chunk.length}/${batch.length}\r`);
  }

  console.log(`\nBatch done: ${success} uploaded, ${fail} failed | Total progress: ${done.size}/${allFiles.length}`);

  if (done.size < allFiles.length) {
    console.log(`Run this script again to continue (${allFiles.length - done.size} remaining)`);
  } else {
    console.log("ALL COVERS MIGRATED!");
  }
}

main().catch(console.error);
