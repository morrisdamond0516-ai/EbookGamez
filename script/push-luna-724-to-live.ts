/**
 * Fix live Luna: local draft #724 ≠ live draft #740 / catalog #714.
 * Push matches by exact title, so renames never update the storefront row.
 *
 *   node script/run-tsx.mjs script/push-luna-724-to-live.ts
 */
import "./load-env.ts";
import fs from "fs";
import path from "path";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { rewriteContentIllustrationUrls } from "../server/illustrationSync";

const LIVE = (process.env.REPLIT_URL || "https://ebookgamez.com").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("ADMIN_PASSWORD required");

const LOCAL_DRAFT = 724;
const LIVE_DRAFT = 740;
const LIVE_BOOK = 714;
const COVER_FILE = "ai-bg-artistic-painterly-1784879919109.png";

async function main() {
  const [local] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, LOCAL_DRAFT));
  if (!local?.title) throw new Error("local draft 724 missing");
  console.log(`Local: "${local.title}" → live draft #${LIVE_DRAFT} / book #${LIVE_BOOK}`);

  const login = await fetch(`${LIVE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(20000),
  });
  if (!login.ok) throw new Error(`login failed ${login.status}`);
  const { token } = (await login.json()) as { token?: string };
  if (!token) throw new Error("no token");
  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  const coverPath = path.join(process.cwd(), "uploads", "covers", COVER_FILE);
  if (!fs.existsSync(coverPath)) throw new Error(`cover missing: ${coverPath}`);
  const coverRes = await fetch(`${LIVE}/api/admin/receive-cover-file`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: COVER_FILE,
      dataBase64: fs.readFileSync(coverPath).toString("base64"),
    }),
    signal: AbortSignal.timeout(120000),
  });
  const coverText = await coverRes.text();
  console.log("cover upload", coverRes.status, coverText.slice(0, 200));
  if (!coverRes.ok) throw new Error("cover upload failed");
  const coverUrl = (JSON.parse(coverText) as { url: string }).url;

  const patch = await fetch(`${LIVE}/api/content-studio/drafts/${LIVE_DRAFT}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title: local.title }),
    signal: AbortSignal.timeout(30000),
  });
  console.log("patch draft", patch.status, (await patch.text()).slice(0, 200));
  if (!patch.ok) throw new Error("patch draft failed");

  const bookPut = await fetch(`${LIVE}/api/books/${LIVE_BOOK}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      title: local.title,
      coverUrl,
      description: local.description || undefined,
      sourceDraftId: LIVE_DRAFT,
      visible: true,
    }),
    signal: AbortSignal.timeout(30000),
  });
  console.log("book put", bookPut.status, (await bookPut.text()).slice(0, 250));
  if (!bookPut.ok) throw new Error("book put failed");

  const sync = await fetch(`${LIVE}/api/admin/receive-draft-sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      drafts: [
        {
          id: LOCAL_DRAFT,
          title: local.title,
          genre: local.genre,
          topic: local.topic,
          content: rewriteContentIllustrationUrls(local.content || ""),
          coverUrl,
          backgroundUrl: coverUrl,
          status: "published",
          description: local.description,
          suggestedPrice: local.suggestedPrice,
          publishedAt: local.publishedAt,
        },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });
  console.log("draft sync", sync.status, (await sync.text()).slice(0, 300));
  if (!sync.ok) throw new Error("draft sync failed");

  for (const q of ["Luna Ortiz", "Luna and the Starwhale", "Unbuttoning Stars"]) {
    const r = await fetch(`${LIVE}/api/books?search=${encodeURIComponent(q)}&limit=5`);
    const data = (await r.json()) as { books?: Array<{ id: number; title: string; sourceDraftId?: number }> };
    const list = data.books || [];
    const line =
      list.length === 0
        ? "(none)"
        : list.map((b) => `#${b.id} ${b.title} draft=${b.sourceDraftId}`).join(" | ");
    console.log(`SEARCH ${q}: ${line}`);
  }
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
