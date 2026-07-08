import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { sql, desc } from "drizzle-orm";

const SUGGESTED_KEYWORDS = [
  "Ember Bond",
  "Neighbor",
  "Last Upload",
  "Maple Inn",
  "Extra Innings",
  "Hollowmere",
  "Fae Court",
  "Midnight Librarian",
  "Code Black",
  "Stars Go Dark",
  "One More Chapter",
  "Briar Lane",
  "Forgotten Kingdom",
  "5-Minute Reset",
  "Anxiety Toolkit",
  "Mind Like Water",
  "Clockwork Forest",
  "Starwhale",
  "Captain Whiskers",
  "Dragon Academy",
  "Brain Busters",
  "Puzzle Planet",
];

const all = await db
  .select({
    id: draftEbooks.id,
    title: draftEbooks.title,
    genre: draftEbooks.genre,
    status: draftEbooks.status,
    coverUrl: draftEbooks.coverUrl,
    backgroundUrl: draftEbooks.backgroundUrl,
    coverStyleId: draftEbooks.coverStyleId,
  })
  .from(draftEbooks)
  .orderBy(desc(draftEbooks.id));

console.log(`Total drafts in DB: ${all.length}\n`);

const matches: typeof all = [];
for (const kw of SUGGESTED_KEYWORDS) {
  const lower = kw.toLowerCase();
  for (const d of all) {
    if (d.title.toLowerCase().includes(lower) && !matches.some((m) => m.id === d.id)) {
      matches.push(d);
    }
  }
}

if (matches.length === 0) {
  console.log("No drafts matching the 22 suggested title keywords were found in this database.");
} else {
  console.log(`Found ${matches.length} draft(s) matching suggested titles:\n`);
  for (const d of matches) {
    const placer = !d.coverStyleId && !d.coverUrl && !d.backgroundUrl;
    console.log(
      `#${d.id} | ${d.title} | ${d.genre} | ${d.status} | ${placer ? "PLACER (no cover)" : "has cover/style"}`,
    );
  }
}

const briefRows = await db
  .select({ id: draftEbooks.id, title: draftEbooks.title })
  .from(draftEbooks)
  .where(sql`${draftEbooks.description} like '%WRITING_BRIEF_START%'`);

console.log(`\nDrafts from AI Research button (writing brief): ${briefRows.length}`);
for (const d of briefRows.slice(0, 20)) {
  console.log(`  #${d.id} ${d.title}`);
}

await db.$client.end?.();
