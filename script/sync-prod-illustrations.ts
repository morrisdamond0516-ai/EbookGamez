/**
 * Pull draft content + illustration PNGs from production (ebookgamez.com) into local DB and uploads/.
 * No AI regeneration — only copies what production still serves.
 *
 *   npm run sync:prod-illustrations
 *   npm run sync:prod-illustrations -- --dry-run
 *   npm run sync:prod-illustrations -- --id 476 661
 */
import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const CONCURRENCY = 6;
const DOWNLOAD_CONCURRENCY = 8;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const idIdx = args.indexOf("--id");
const onlyIds =
  idIdx >= 0
    ? args
        .slice(idIdx + 1)
        .map((a) => parseInt(a, 10))
        .filter((n) => !Number.isNaN(n))
    : null;

async function loginAdmin(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not set in .env");
  const res = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Production admin login failed (${res.status}). Check ADMIN_PASSWORD.`);
  const data = await res.json();
  if (!data.token) throw new Error("No admin token from production");
  return data.token;
}

function countResolved(content: string): number {
  return (content.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
}

function countStripped(content: string): number {
  return (content.match(/high-quality illustration needed here/gi) || []).length;
}

/** Unique illustration filenames referenced in content. */
function extractIllustrationFiles(content: string): string[] {
  const names = new Set<string>();
  for (const m of content.matchAll(/\/(?:uploads|objstore)\/illustrations\/(illust-[^\s|"\]]+\.png)/gi)) {
    names.add(m[1]);
  }
  return [...names];
}

async function downloadIllustration(fname: string, illustDir: string): Promise<"ok" | "exists" | "404" | "error"> {
  const dest = path.join(illustDir, fname);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return "exists";

  const urls = [
    `${PRODUCTION_BASE}/objstore/illustrations/${encodeURIComponent(fname)}`,
    `${PRODUCTION_BASE}/uploads/illustrations/${encodeURIComponent(fname)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) continue;
      if (!dryRun) fs.writeFileSync(dest, buf);
      return "ok";
    } catch {
      /* try next URL */
    }
  }
  return "404";
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log(
  `[sync-prod-illustrations] Source: ${PRODUCTION_BASE}` +
    (dryRun ? " (DRY RUN)" : "") +
    (onlyIds?.length ? ` ids=${onlyIds.join(",")}` : " (all illustrated drafts)"),
);

const token = await loginAdmin();
console.log("Logged in to production admin");

const listRes = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts`, {
  headers: { "x-admin-token": token },
});
if (!listRes.ok) throw new Error(`Failed to list production drafts: ${listRes.status}`);
const prodList = (await listRes.json()) as Array<{
  id: number;
  title: string;
  status: string;
  content?: string;
  contentWordCount?: number;
  hasIllustrations?: boolean;
  totalIllustrations?: number;
  pendingIllustrations?: number;
}>;

const hasResolvedImages = (c: string) =>
  /\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//.test(c);

let targets = prodList.filter((d) => {
  const c = d.content || "";
  if (hasResolvedImages(c)) return true;
  if (d.hasIllustrations) return true;
  return (Number(d.totalIllustrations) || 0) > 0;
});
if (onlyIds?.length) targets = targets.filter((d) => onlyIds.includes(d.id));

console.log(`Production drafts with illustrations: ${targets.length}`);

const illustDir = path.join(process.cwd(), "uploads", "illustrations");
if (!dryRun && !fs.existsSync(illustDir)) fs.mkdirSync(illustDir, { recursive: true });

let contentUpdated = 0;
let contentSkipped = 0;
let contentFailed = 0;
const allFiles = new Set<string>();

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const batch = targets.slice(i, i + CONCURRENCY);
  await Promise.all(
    batch.map(async (item) => {
      try {
        let prodContent = item.content && item.content.length > 100 ? item.content : "";
        if (!prodContent) {
          const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts/${item.id}`, {
            headers: { "x-admin-token": token },
          });
          if (!res.ok) {
            contentFailed++;
            return;
          }
          const prod = (await res.json()) as { content?: string };
          prodContent = prod.content || "";
        }
        if (prodContent.length < 100) {
          contentSkipped++;
          return;
        }

        for (const f of extractIllustrationFiles(prodContent)) allFiles.add(f);

        const [local] = await db.select({ content: draftEbooks.content }).from(draftEbooks).where(eq(draftEbooks.id, item.id));
        const localContent = local?.content || "";
        const prodResolved = countResolved(prodContent);
        const localResolved = countResolved(localContent);
        const localStripped = countStripped(localContent);

        const shouldUpdate =
          !localContent ||
          prodResolved > localResolved ||
          localStripped > 0 ||
          (prodResolved === localResolved && prodContent.length > localContent.length + 500);

        if (!shouldUpdate) {
          contentSkipped++;
          // Still collect files from local content for download pass
          for (const f of extractIllustrationFiles(localContent)) allFiles.add(f);
          return;
        }

        if (!dryRun) {
          await db
            .update(draftEbooks)
            .set({ content: prodContent })
            .where(eq(draftEbooks.id, item.id));
        }
        contentUpdated++;
        console.log(
          `  content #${item.id}: prod=${prodResolved} local=${localResolved} stripped=${localStripped} → ${dryRun ? "would update" : "updated"}`,
        );
      } catch (e: any) {
        contentFailed++;
        console.warn(`  FAIL content #${item.id}: ${e.message}`);
      }
    }),
  );
  if ((i + CONCURRENCY) % 30 === 0 || i + CONCURRENCY >= targets.length) {
    console.log(`Content progress: ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}`);
  }
}

console.log(`\nContent: updated=${contentUpdated} skipped=${contentSkipped} failed=${contentFailed}`);
console.log(`Unique illustration files to fetch: ${allFiles.size}\n`);

let downloaded = 0;
let already = 0;
let missing = 0;
let dlErrors = 0;
const fileList = [...allFiles].sort();

for (let i = 0; i < fileList.length; i += DOWNLOAD_CONCURRENCY) {
  const batch = fileList.slice(i, i + DOWNLOAD_CONCURRENCY);
  const results = await Promise.all(batch.map((f) => downloadIllustration(f, illustDir)));
  for (const r of results) {
    if (r === "ok") downloaded++;
    else if (r === "exists") already++;
    else if (r === "404") missing++;
    else dlErrors++;
  }
  if ((i + DOWNLOAD_CONCURRENCY) % 100 === 0 || i + DOWNLOAD_CONCURRENCY >= fileList.length) {
    console.log(
      `Download progress: ${Math.min(i + DOWNLOAD_CONCURRENCY, fileList.length)}/${fileList.length} (new=${downloaded} exists=${already} 404=${missing})`,
    );
  }
}

console.log(`\n=== Done ===`);
console.log(`Content rows updated from production: ${contentUpdated}`);
console.log(`Illustration files: ${downloaded} downloaded, ${already} already local, ${missing} not on production (404)`);
if (missing > 0) {
  console.log(
    `\n${missing} file(s) are not served by ${PRODUCTION_BASE} — those images may be gone from cloud storage.`,
  );
  console.log("Replit Object Storage backup or repair-gcs on Replit is needed for those.");
}
if (!dryRun && downloaded > 0) {
  console.log(`\nLocal files saved to uploads/illustrations/ — deploy or run repair-gcs on Replit to push to cloud.`);
}

await pool.end();
