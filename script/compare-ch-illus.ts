import "./load-env.ts";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

for (const id of [661, 728, 385]) {
  const content = (await c.query(`SELECT content FROM draft_ebooks WHERE id=$1`, [id])).rows[0]?.content || "";
  const chapters = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  let chZero = 0;
  for (let i = 0; i < chapters.length; i++) {
    const start = chapters[i].index!;
    const end = i + 1 < chapters.length ? chapters[i + 1].index! : content.length;
    const ch = content.slice(start, end);
    const resolved = (ch.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    if (resolved === 0) chZero++;
  }
  const pending = [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)].filter(
    (m) => !/^(\/|http)/.test(m[1].trim()),
  ).length;
  const resolved = (content.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  console.log(`#${id} chapters=${chapters.length} chWithZeroResolved=${chZero} pending=${pending} resolved=${resolved}`);
}

await c.end();
