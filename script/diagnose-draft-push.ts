/**
 * Diagnose a draft's push-to-production readiness.
 * Usage: npx tsx --import ./script/load-env.ts script/diagnose-draft-push.ts 140
 */
import "./load-env.ts";
import pg from "pg";
import fs from "fs";
import path from "path";

const draftId = parseInt(process.argv[2] || "140", 10);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: drafts } = await client.query(
  `SELECT id, title, status, cover_url, background_url, published_at,
          CASE WHEN content IS NULL THEN 0 ELSE length(content) END AS content_len
   FROM draft_ebooks WHERE id = $1`,
  [draftId],
);
const draft = drafts[0];
if (!draft) {
  console.error(`Draft #${draftId} not found`);
  process.exit(1);
}

console.log("\n=== Draft ===");
console.log(draft);

const { rows: books } = await client.query(
  `SELECT id, title, visible, cover_url, source_draft_id
   FROM books
   WHERE source_draft_id = $1 OR LOWER(title) = LOWER($2)`,
  [draftId, draft.title],
);
console.log("\n=== Catalog (local) ===");
console.log(books.length ? books : "(no matching catalog book)");

function coverFileExists(url: string | null): boolean {
  if (!url) return false;
  const m = url.match(/\/(?:uploads|objstore)\/covers\/(.+)$/);
  if (!m) return false;
  const p = path.join(process.cwd(), "uploads", "covers", m[1]);
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

console.log("\n=== Cover files (local disk) ===");
console.log("cover_url file:", coverFileExists(draft.cover_url) ? "YES" : "NO", draft.cover_url || "(null)");
console.log("background_url file:", coverFileExists(draft.background_url) ? "YES" : "NO", draft.background_url || "(null)");

const prodUrl = (process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com").replace(/\/$/, "");
console.log("\n=== Production URL to use in Push panel ===");
console.log(prodUrl);
console.log("(NOT http://127.0.0.1:3000 — that only updates your local copy)");

if (process.env.ADMIN_PASSWORD) {
  try {
    const login = await fetch(`${prodUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
      signal: AbortSignal.timeout(15000),
    });
    console.log("\n=== Production login ===", login.status, login.ok ? "OK" : await login.text());
    if (login.ok) {
      const { token } = (await login.json()) as { token?: string };
      const probe = await fetch(`${prodUrl}/api/admin/receive-cover-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token || "" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000),
      });
      console.log(
        "receive-cover-file endpoint:",
        probe.status === 400 ? "EXISTS (needs body)" : probe.status === 404 ? "MISSING — deploy latest code to production" : probe.status,
      );
    }
  } catch (e: any) {
    console.log("\n=== Production probe failed ===", e.message);
  }
}

await client.end();
