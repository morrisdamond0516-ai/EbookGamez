import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  countUnprocessedIllustrationMarkers,
  unwrapNonImageIllustrationMarkers,
} from "../shared/activityBookContent";

const draftId = 682;
const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
if (!d) {
  console.log("draft 682 not found");
  process.exit(1);
}
const c = d.content || "";
console.log(`draft #682 [${d.status}] genre=${d.genre}`);
console.log(`pending markers: ${countUnprocessedIllustrationMarkers(c)}`);
const all = [...c.matchAll(/\[ILLUSTRATION:[^\]]*\]/gi)];
console.log(`total [ILLUSTRATION:] tags: ${all.length}`);
for (const m of all.slice(0, 10)) console.log(`  ${m[0].slice(0, 120)}`);

const catalog = await db.select().from(books).where(eq(books.sourceDraftId, 682));
const byTitle = await db
  .select()
  .from(books)
  .where(sql`${books.title} = ${d.title}`);
console.log("\ncatalog by sourceDraftId:", catalog.map((b) => b.id));
console.log("catalog by title:", byTitle.map((b) => ({ id: b.id, sourceDraftId: b.sourceDraftId })));

// production compare
const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const { token } = (await login.json()) as { token: string };
const prod = await fetch(`${BASE}/api/content-studio/drafts/682`, {
  headers: { "x-admin-token": token },
});
const pd = (await prod.json()) as { content?: string };
const pc = pd.content || "";
const prodMarkers = [...pc.matchAll(/\[ILLUSTRATION:[^\]]*\]/gi)];
console.log(`\nproduction markers: ${prodMarkers.length}`);
for (const m of prodMarkers.slice(0, 8)) console.log(`  prod: ${m[0].slice(0, 120)}`);

const unwrapped = unwrapNonImageIllustrationMarkers(pc);
console.log(`prod unwrap would remove: ${unwrapped.removed}`);
