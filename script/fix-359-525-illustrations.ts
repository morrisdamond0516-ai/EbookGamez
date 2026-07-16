/**
 * Fix drafts #359 and #525: pull production content, strip fake worksheet [ILLUSTRATION:] tags.
 * No AI illustration generation.
 */
import "./load-env.ts";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { draftEbooks } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { stripFakeWorksheetIllustrationMarkers, countResolvedIllustrationMarkers } from "../shared/activityBookContent";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const IDS = [359, 525];

const login = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
if (!login.ok) throw new Error(`Production login failed (${login.status})`);
const { token } = await login.json();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

for (const id of IDS) {
  const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts/${id}`, {
    headers: { "x-admin-token": token },
  });
  if (!res.ok) {
    console.warn(`#${id}: production fetch failed ${res.status}`);
    continue;
  }
  const prod = (await res.json()) as { content?: string; title?: string };
  let content = prod.content || "";

  const stripped = stripFakeWorksheetIllustrationMarkers(content);
  content = stripped.content;

  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, id));

  console.log(
    `#${id} "${(prod.title || "").slice(0, 50)}" — resolved=${countResolvedIllustrationMarkers(content)} stripped_fake=${stripped.removed}`,
  );
}

await pool.end();
