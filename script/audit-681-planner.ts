import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";
import {
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
  isActivityOrWorkbookGenre,
} from "../shared/activityBookContent";

const id = 681;
const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
if (!d) {
  console.log("not found locally");
  process.exit(1);
}
const c = d.content || "";
console.log(`#${d.id} [${d.status}] genre=${d.genre}`);
console.log(`title: ${d.title}`);
console.log(`content len: ${c.length}`);
console.log(`isActivityOrWorkbook: ${isActivityOrWorkbookGenre(d.genre)}`);
console.log(`resolved illus: ${countResolvedIllustrationMarkers(c)}`);
console.log(`pending illus: ${countUnprocessedIllustrationMarkers(c)}`);
console.log(`stripped placeholders: ${(c.match(/high-quality illustration needed here/gi) || []).length}`);

const allMarkers = [...c.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
console.log(`total markers: ${allMarkers.length}`);
for (const m of allMarkers.slice(0, 8)) {
  console.log(`  ${m[0].slice(0, 100)}`);
}

// other planners
const planners = await db
  .select({ id: draftEbooks.id, title: draftEbooks.title, status: draftEbooks.status, genre: draftEbooks.genre, content: draftEbooks.content })
  .from(draftEbooks)
  .where(sql`${draftEbooks.genre} ILIKE '%planner%'`);
console.log(`\n=== Planners in DB (${planners.length}) ===`);
for (const p of planners) {
  const pc = p.content || "";
  const pending = countUnprocessedIllustrationMarkers(pc);
  const resolved = countResolvedIllustrationMarkers(pc);
  const stripped = (pc.match(/high-quality illustration needed here/gi) || []).length;
  console.log(`#${p.id} [${p.status}] pending=${pending} resolved=${resolved} stripped=${stripped} — ${(p.title || "").slice(0, 55)}`);
}
