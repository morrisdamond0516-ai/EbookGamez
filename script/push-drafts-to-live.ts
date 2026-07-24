/**
 * Push selected published drafts (content + illustrations) to live.
 *   npx tsx script/push-drafts-to-live.ts 724 725 696
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  extractIllustrationFilenames,
  readIllustrationBytesForSync,
  rewriteContentIllustrationUrls,
} from "../server/illustrationSync";

const ids = process.argv.slice(2).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
if (ids.length === 0) {
  console.error("Usage: npx tsx script/push-drafts-to-live.ts <id> [id...]");
  process.exit(1);
}

const LIVE = (process.env.REPLIT_URL || "https://ebookgamez.com").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("ADMIN_PASSWORD required");

async function login(): Promise<string> {
  const res = await fetch(`${LIVE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Login failed ${res.status}`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("No token");
  return data.token;
}

async function uploadFile(fname: string) {
  const file = await readIllustrationBytesForSync(fname);
  if (!file) {
    console.log(`    missing local: ${fname}`);
    return false;
  }
  const res = await fetch(`${LIVE}/api/admin/sync/upload-illustrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": password!,
    },
    body: JSON.stringify({
      files: [
        {
          filename: file.filename,
          base64: file.buffer.toString("base64"),
          mimeType: "image/png",
        },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`upload ${fname}: ${res.status} ${t.slice(0, 120)}`);
  }
  return true;
}

async function main() {
  console.log(`Target: ${LIVE}`);
  console.log(`Drafts: ${ids.join(", ")}`);
  const token = await login();
  console.log("Logged in\n");

  const drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
  let consecutiveFail = 0;

  for (const draft of drafts) {
    console.log(`=== #${draft.id} ${draft.title} ===`);
    const names = extractIllustrationFilenames(draft.content);
    console.log(`  ${names.length} illustrations`);
    let uploaded = 0;
    for (let i = 0; i < names.length; i++) {
      process.stdout.write(`  ${i + 1}/${names.length} ${names[i]}... `);
      try {
        const ok = await uploadFile(names[i]);
        console.log(ok ? "ok" : "skip");
        if (ok) uploaded++;
        consecutiveFail = 0;
      } catch (e: any) {
        consecutiveFail++;
        console.log(`FAIL ${e.message}`);
        if (consecutiveFail >= 2) throw new Error("Stopped after 2 consecutive upload failures");
      }
    }
    console.log(`  uploaded ${uploaded}/${names.length}`);

    const sync = await fetch(`${LIVE}/api/admin/receive-draft-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({
        drafts: [
          {
            id: draft.id,
            title: draft.title,
            genre: draft.genre,
            topic: draft.topic,
            content: rewriteContentIllustrationUrls(draft.content || ""),
            coverUrl: draft.coverUrl,
            backgroundUrl: draft.backgroundUrl,
            status: draft.status,
            description: draft.description,
            suggestedPrice: draft.suggestedPrice,
            publishedAt: draft.publishedAt,
          },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
    const syncText = await sync.text();
    console.log(`  draft sync ${sync.status} ${syncText.slice(0, 200)}\n`);
    if (!sync.ok) throw new Error(`draft sync failed for #${draft.id}`);
  }

  console.log("Done. Live site + EbookGamez.replit.app share this deploy.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
