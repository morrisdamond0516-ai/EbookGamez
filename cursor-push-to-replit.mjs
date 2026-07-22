#!/usr/bin/env node
/**
 * cursor-push-to-replit.mjs
 *
 * Pushes locally-generated illustration images to the live Replit site.
 * The Replit server handles GCS upload AND database URL updates — this
 * script only needs to read local files and call the API.
 *
 * NO database connection required. Works from Windows, Mac, or Linux.
 *
 * Usage:
 *   node cursor-push-to-replit.mjs
 *
 * Required — set in a .env file next to this script (or as env vars):
 *   REPLIT_URL=https://ebookgamez.replit.app
 *   ADMIN_PASSWORD=your-admin-password
 *
 * Optional:
 *   ILLUST_DIR=path/to/uploads/illustrations   (default: ./uploads/illustrations)
 *   BATCH_SIZE=20                              (images per API request, default 20)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env ───────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Config ──────────────────────────────────────────────────────────────────
const REPLIT_URL    = (process.env.REPLIT_URL || "").replace(/\/$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ILLUST_DIR    = process.env.ILLUST_DIR
  ? path.resolve(process.env.ILLUST_DIR)
  : path.join(__dirname, "uploads", "illustrations");
const BATCH_SIZE    = Math.max(1, parseInt(process.env.BATCH_SIZE || "20", 10));

if (!REPLIT_URL || !ADMIN_PASSWORD) {
  console.error(`
ERROR: Missing required environment variables.

Create a .env file next to this script with:

  REPLIT_URL=https://ebookgamez.replit.app
  ADMIN_PASSWORD=your-admin-password

No DATABASE_URL needed — the server handles all database updates.
`);
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function uploadBatch(files) {
  const res = await fetch(`${REPLIT_URL}/api/admin/sync/upload-illustrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": ADMIN_PASSWORD,
    },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nEbookGamez — Illustration Push to Replit`);
  console.log(`  Target : ${REPLIT_URL}`);
  console.log(`  Source : ${ILLUST_DIR}\n`);

  // 1. Find illustration files
  if (!fs.existsSync(ILLUST_DIR)) {
    console.error(`ERROR: Illustration folder not found:\n  ${ILLUST_DIR}`);
    console.error(`Make sure you're running this from the project root, or set ILLUST_DIR.`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(ILLUST_DIR).filter(f =>
    /\.(png|jpg|jpeg|webp)$/i.test(f)
  );

  if (allFiles.length === 0) {
    console.log(`No illustration files found in ${ILLUST_DIR}`);
    console.log(`Nothing to push.`);
    return;
  }

  console.log(`Found ${allFiles.length} illustration file(s) to upload.`);
  console.log(`Uploading in batches of ${BATCH_SIZE}...\n`);

  // 2. Upload in batches
  const batches = chunkArray(allFiles, BATCH_SIZE);
  let totalUploaded = 0;
  let totalErrors = 0;
  let totalDbUpdated = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`  Batch ${i + 1}/${batches.length} (${batch.length} files)... `);

    const files = batch.map(fname => {
      const buf = fs.readFileSync(path.join(ILLUST_DIR, fname));
      const ext = path.extname(fname).toLowerCase();
      const mimeType =
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
        ext === ".webp" ? "image/webp" : "image/png";
      return { filename: fname, base64: buf.toString("base64"), mimeType };
    });

    try {
      const result = await uploadBatch(files);
      const batchUploaded = result.results?.filter(r => r.uploaded).length ?? 0;
      const batchErrors   = result.results?.filter(r => !r.uploaded).length ?? 0;
      const batchDb       = result.dbUpdated ?? 0;
      totalUploaded  += batchUploaded;
      totalErrors    += batchErrors;
      totalDbUpdated += batchDb;

      console.log(`✅ ${batchUploaded} uploaded, ${batchDb} drafts updated`);

      if (batchErrors > 0) {
        for (const r of (result.results || [])) {
          if (!r.uploaded) console.log(`     ✗ ${r.filename}: ${r.error}`);
        }
      }
    } catch (err) {
      totalErrors += batch.length;
      console.log(`❌ FAILED: ${err.message}`);
    }
  }

  // 3. Summary
  console.log(`\n── Summary ──────────────────────────────`);
  console.log(`  Files uploaded to cloud : ${totalUploaded} / ${allFiles.length}`);
  console.log(`  Upload errors           : ${totalErrors}`);
  console.log(`  Drafts updated in DB    : ${totalDbUpdated}`);

  if (totalUploaded > 0) {
    console.log(`\n✅ Done! Images are now in Replit cloud storage.`);
    console.log(`   Draft content URLs updated automatically on the server.`);
    console.log(`   Deploy from Replit to make changes live on the public site.`);
  } else {
    console.log(`\n⚠️  No files were uploaded. Check the errors above.`);
  }
}

main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
