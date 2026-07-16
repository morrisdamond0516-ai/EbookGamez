import "./load-env.ts";
import pg from "pg";
import { countAsciiPuzzleLines } from "../shared/activityBookContent.ts";
import { draftHasPublishableCover } from "../server/coverStorage.ts";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT id, title, genre, status, content, cover_url, background_url, description, published_at FROM draft_ebooks WHERE id = 728`,
);
const d = r.rows[0];
const content = d.content || "";
console.log("#728", d.title, d.status, d.genre);
console.log("cover publishable:", draftHasPublishableCover(d));

const chapters = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
let totalPending = 0;
let totalResolved = 0;
for (let i = 0; i < chapters.length; i++) {
  const start = chapters[i].index!;
  const end = i + 1 < chapters.length ? chapters[i + 1].index! : content.length;
  const ch = content.slice(start, end);
  const all = [...ch.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)];
  const pending = all.filter((m) => !/^(\/|http)/.test(m[1].trim()));
  const resolved = all.filter((m) => /^(\/|http)/.test(m[1].trim()));
  totalPending += pending.length;
  totalResolved += resolved.length;
  const ascii = countAsciiPuzzleLines(ch);
  if (pending.length || ascii) {
    console.log(
      `  Ch${chapters[i][1]}: resolved=${resolved.length} pending=${pending.length} ascii=${ascii}`,
    );
  }
}
console.log(`TOTAL: resolved=${totalResolved} pending=${totalPending}`);
await c.end();
