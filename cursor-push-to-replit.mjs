#!/usr/bin/env node
/**
 * cursor-push-to-replit.mjs
 *
 * Push local illustration PNGs to the live Replit site. No DATABASE_URL required —
 * the server saves files to cloud storage and updates draft content paths on Replit.
 *
 * Usage (from project root):
 *   node cursor-push-to-replit.mjs
 *   node cursor-push-to-replit.mjs --all        # upload every illust-*.png locally (careful)
 *
 * Required in .env:
 *   REPLIT_URL=https://ebookgamez.replit.app
 *   ADMIN_PASSWORD=your-admin-password
 *
 * Optional: DATABASE_URL (local Postgres) limits upload to files referenced in draft_ebooks.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadAll = process.argv.includes("--all");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
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
const BATCH_SIZE = 20;
const LOCAL_ILLUST_DIR = path.join(__dirname, "uploads", "illustrations");

if (!REPLIT_URL || !ADMIN_PASSWORD) {
  console.error(`
ERROR: Missing required environment variables.

Add to .env:
  REPLIT_URL=https://ebookgamez.replit.app
  ADMIN_PASSWORD=your-admin-password
`);
  process.exit(1);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function listAllLocalIllustrations() {
  if (!fs.existsSync(LOCAL_ILLUST_DIR)) return [];
  return fs
    .readdirSync(LOCAL_ILLUST_DIR)
    .filter((f) => /^illust-.*\.(png|jpe?g|webp)$/i.test(f))
    .sort();
}

function extractFilenamesFromContent(content) {
  const re = /\/uploads\/illustrations\/(illust-[^\s|"'\]]+\.(?:png|jpe?g|webp))/gi;
  const names = new Set();
  let m;
  while ((m = re.exec(content)) !== null) names.add(m[1]);
  return names;
}

async function filenamesReferencedInLocalDb() {
  if (!DATABASE_URL || DATABASE_URL.includes("your-postgresql")) return null;
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({ connectionString: DATABASE_URL });
    const { rows } = await pool.query(
      `SELECT content FROM draft_ebooks WHERE content LIKE '%/uploads/illustrations/%'`,
    );
    await pool.end();
    const names = new Set();
    for (const row of rows) {
      for (const f of extractFilenamesFromContent(row.content || "")) names.add(f);
    }
    return names;
  } catch {
    return null;
  }
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
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return data;
}

async function main() {
  console.log(`\n🌐 Replit URL: ${REPLIT_URL}`);

  if (!fs.existsSync(LOCAL_ILLUST_DIR)) {
    console.error(`\n❌ Folder not found: ${LOCAL_ILLUST_DIR}`);
    process.exit(1);
  }

  let toUpload;
  if (uploadAll) {
    toUpload = listAllLocalIllustrations();
    console.log(`📁 --all: uploading every local illustration (${toUpload.length} files)`);
  } else {
    const fromDb = await filenamesReferencedInLocalDb();
    if (fromDb && fromDb.size > 0) {
      toUpload = [...fromDb].filter((f) => fs.existsSync(path.join(LOCAL_ILLUST_DIR, f))).sort();
      console.log(`📁 ${toUpload.length} file(s) referenced in local draft_ebooks (with /uploads/ paths)`);
    } else {
      toUpload = listAllLocalIllustrations();
      if (toUpload.length > 50) {
        console.error(`
❌ Found ${toUpload.length} local illustration files but no local DB match.
   Uploading everything would be slow and expensive.

Options:
  • Keep DATABASE_URL in .env pointing at local Postgres (recommended), then re-run
  • Or pass --all to upload every file anyway
`);
        process.exit(1);
      }
      console.log(`📁 No local DB filter — uploading ${toUpload.length} file(s) from disk`);
    }
  }

  if (toUpload.length === 0) {
    console.log("\n✅ Nothing to upload.");
    return;
  }

  const batches = chunkArray(toUpload, BATCH_SIZE);
  let totalUploaded = 0;
  let totalErrors = 0;
  let totalDraftsUpdated = 0;

  console.log(`\n📤 Uploading in ${batches.length} batch(es) of up to ${BATCH_SIZE}...\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`   Batch ${i + 1}/${batches.length} (${batch.length} files)... `);

    const files = batch.map((fname) => {
      const data = fs.readFileSync(path.join(LOCAL_ILLUST_DIR, fname));
      const ext = path.extname(fname).toLowerCase();
      const mimeType =
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
      return { filename: fname, base64: data.toString("base64"), mimeType };
    });

    try {
      const result = await uploadBatch(files);
      const ok = result.results?.filter((r) => r.uploaded).length ?? result.uploaded ?? 0;
      const bad = result.results?.filter((r) => !r.uploaded).length ?? result.errors ?? 0;
      totalUploaded += ok;
      totalErrors += bad;
      for (const r of result.results || []) {
        if (r.uploaded && r.draftsUpdated) totalDraftsUpdated += r.draftsUpdated;
        if (!r.uploaded) console.log(`\n     ✗ ${r.filename}: ${r.error}`);
      }
      console.log(`✅ ${ok} uploaded, ${bad} errors`);
    } catch (err) {
      totalErrors += batch.length;
      console.log(`❌ FAILED: ${err.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   • Files uploaded: ${totalUploaded}`);
  console.log(`   • Upload errors: ${totalErrors}`);
  console.log(`   • Draft rows updated on Replit: ${totalDraftsUpdated}`);
  console.log(`\n✅ Done. Open the live site to verify illustrations.`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});
