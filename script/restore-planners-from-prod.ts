/**
 * Re-fetch planner draft content from production, then unwrap bogus [ILLUSTRATION:] tags.
 */
import "./load-env.ts";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { draftEbooks } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { unwrapNonImageIllustrationMarkers, countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
if (!login.ok) throw new Error(`login ${login.status}`);
const { token } = (await login.json()) as { token: string };

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const local = await db
  .select({ id: draftEbooks.id, title: draftEbooks.title })
  .from(draftEbooks)
  .where(sql`${draftEbooks.genre} ILIKE '%planner%'`);

for (const d of local) {
  const res = await fetch(`${BASE}/api/content-studio/drafts/${d.id}`, {
    headers: { "x-admin-token": token },
  });
  if (!res.ok) {
    console.warn(`#${d.id}: prod fetch ${res.status}`);
    continue;
  }
  const prod = (await res.json()) as { content?: string };
  let content = prod.content || "";
  const unwrapped = unwrapNonImageIllustrationMarkers(content);
  content = unwrapped.content;
  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, d.id));
  console.log(
    `#${d.id} prod_sync + unwrapped=${unwrapped.removed} pending=${countUnprocessedIllustrationMarkers(content)} — ${(d.title || "").slice(0, 45)}`,
  );
}

await pool.end();
