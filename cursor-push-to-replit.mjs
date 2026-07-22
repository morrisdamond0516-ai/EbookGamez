#!/usr/bin/env node
/**
 * cursor-push-to-replit.mjs
 *
 * Run this from your Cursor project root to push new illustration images
 * to the live Replit site and update the database content to use cloud URLs.
 *
 * Usage:
 *   node cursor-push-to-replit.mjs
 *
 * Set these environment variables (or put them in a .env file):
 *   REPLIT_URL=https://ebookgamez.replit.app
 *   ADMIN_PASSWORD=your-admin-password
 *   DATABASE_URL=your-postgresql-connection-string
 *
 * What it does:
 *   1. Connects to the shared Replit database
 *   2. Finds all draft ebooks that still have local /uploads/illustrations/ paths
 *   3. Reads each image file from local disk
 *   4. Uploads them to Replit's object storage via the API (in batches)
 *   5. Updates the database: replaces /uploads/illustrations/ with /objstore/illustrations/
 *   6. Reports what was synced
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
// Load a .env file if present (simple parser, no dotenv dependency needed)
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const REPLIT_URL = (process.env.REPLIT_URL || "").replace(/\/$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const BATCH_SIZE = 20; // images per API request
const LOCAL_ILLUST_DIR = path.join(__dirname, "uploads", "illustrations");

if (!REPLIT_URL || !ADMIN_PASSWORD || !DATABASE_URL) {
  console.error(`
ERROR: Missing required environment variables.

Please set:
  REPLIT_URL=https://ebookgamez.replit.app
  ADMIN_PASSWORD=your-admin-password
  DATABASE_URL=your-postgresql-connection-string

You can put these in a .env file next to this script.
`);
  process.exit(1);
}

// ── DB connection ───────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function extractLocalIllustrations(content) {
  const re = /\/uploads\/illustrations\/(illust-[^\s|"'\]]+\.(?:png|jpg|jpeg|webp))/gi;
  const matches = new Set();
  let m;
  while ((m = re.exec(content)) !== null) matches.add(m[1]);
  return [...matches];
}

async function uploadBatch(files) {
  const body = JSON.stringify({ files });
  const res = await fetch(`${REPLIT_URL}/api/admin/sync/upload-illustrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": ADMIN_PASSWORD,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return await res.json();
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔗 Connecting to database...`);
  await query("SELECT 1");
  console.log(`✅ Database connected.`);
  console.log(`🌐 Replit URL: ${REPLIT_URL}`);

  // 1. Find all drafts with local illustration paths
  console.log(`\n🔍 Scanning draft_ebooks for local illustration paths...`);
  const { rows: drafts } = await query(
    `SELECT id, title, content FROM draft_ebooks WHERE content LIKE '%/uploads/illustrations/%'`
  );
  console.log(`   Found ${drafts.length} draft(s) with local illustration paths.`);

  if (drafts.length === 0) {
    console.log(`\n✅ Nothing to push — all illustrations already use cloud URLs.`);
    await pool.end();
    return;
  }

  // 2. Collect unique filenames that actually exist locally
  const filenameToContent = {}; // filename → Set of draft ids that reference it
  for (const draft of drafts) {
    const fnames = extractLocalIllustrations(draft.content || "");
    for (const fname of fnames) {
      if (!filenameToContent[fname]) filenameToContent[fname] = new Set();
      filenameToContent[fname].add(draft.id);
    }
  }

  const allFilenames = Object.keys(filenameToContent);
  console.log(`   Found ${allFilenames.length} unique illustration file(s) to upload.`);

  // 3. Filter to files that exist locally
  const missing = [];
  const toUpload = [];
  for (const fname of allFilenames) {
    const localPath = path.join(LOCAL_ILLUST_DIR, fname);
    if (fs.existsSync(localPath)) {
      toUpload.push(fname);
    } else {
      missing.push(fname);
    }
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} file(s) not found locally (will be skipped):`);
    for (const f of missing.slice(0, 10)) console.log(`   - ${f}`);
    if (missing.length > 10) console.log(`   ... and ${missing.length - 10} more`);
  }

  if (toUpload.length === 0) {
    console.log(`\n⚠️  No local illustration files found in ${LOCAL_ILLUST_DIR}`);
    console.log(`   Make sure this script is run from the project root where uploads/ exists.`);
    await pool.end();
    return;
  }

  // 4. Upload files to Replit in batches
  console.log(`\n📤 Uploading ${toUpload.length} illustration(s) in batches of ${BATCH_SIZE}...`);
  const batches = chunkArray(toUpload, BATCH_SIZE);
  const uploadedFilenames = new Set();
  let totalUploaded = 0;
  let totalErrors = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`   Batch ${i + 1}/${batches.length} (${batch.length} files)... `);

    const files = batch.map(fname => {
      const localPath = path.join(LOCAL_ILLUST_DIR, fname);
      const data = fs.readFileSync(localPath);
      const ext = path.extname(fname).toLowerCase();
      const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
      return { filename: fname, base64: data.toString("base64"), mimeType };
    });

    try {
      const result = await uploadBatch(files);
      const batchUploaded = result.results?.filter(r => r.uploaded).length ?? 0;
      const batchErrors = result.results?.filter(r => !r.uploaded).length ?? 0;
      totalUploaded += batchUploaded;
      totalErrors += batchErrors;
      for (const r of result.results || []) {
        if (r.uploaded) uploadedFilenames.add(r.filename);
      }
      console.log(`✅ ${batchUploaded} uploaded, ${batchErrors} errors`);
      if (batchErrors > 0) {
        for (const r of result.results || []) {
          if (!r.uploaded) console.log(`     ✗ ${r.filename}: ${r.error}`);
        }
      }
    } catch (err) {
      totalErrors += batch.length;
      console.log(`❌ FAILED: ${err.message}`);
    }
  }

  console.log(`\n   Upload complete: ${totalUploaded} succeeded, ${totalErrors} failed.`);

  // 5. Update database: replace local paths with objstore paths for successfully uploaded files
  if (uploadedFilenames.size === 0) {
    console.log(`\n⚠️  No files were successfully uploaded — skipping database update.`);
    await pool.end();
    return;
  }

  console.log(`\n✏️  Updating database content for ${uploadedFilenames.size} file(s)...`);
  let dbUpdated = 0;

  // Re-fetch drafts fresh (in case content changed during upload)
  const { rows: freshDrafts } = await query(
    `SELECT id, title, content FROM draft_ebooks WHERE content LIKE '%/uploads/illustrations/%'`
  );

  for (const draft of freshDrafts) {
    let content = draft.content || "";
    let changed = false;

    for (const fname of uploadedFilenames) {
      const localUrl = `/uploads/illustrations/${fname}`;
      const cloudUrl = `/objstore/illustrations/${fname}`;
      if (content.includes(localUrl)) {
        content = content.replaceAll(localUrl, cloudUrl);
        changed = true;
      }
    }

    if (changed) {
      await query(`UPDATE draft_ebooks SET content = $1 WHERE id = $2`, [content, draft.id]);
      console.log(`   ✅ Updated draft ${draft.id}: "${draft.title}"`);
      dbUpdated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   • Illustration files uploaded to Replit object storage: ${totalUploaded}`);
  console.log(`   • Files not found locally (skipped): ${missing.length}`);
  console.log(`   • Upload errors: ${totalErrors}`);
  console.log(`   • Database drafts updated: ${dbUpdated}`);
  console.log(`\n✅ Done! The live site will now serve illustrations from cloud storage.`);
  console.log(`   If you want to publish drafts, use the Replit admin panel.`);

  await pool.end();
}

main().catch(err => {
  console.error(`\n❌ Fatal error:`, err.message);
  process.exit(1);
});
