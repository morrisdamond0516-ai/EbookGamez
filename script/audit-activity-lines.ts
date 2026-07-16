/**
 * Audit activity/workbook books for line & structure issues.
 */
import "./load-env.ts";
import pg from "pg";
import {
  isActivityOrWorkbookGenre,
  countAsciiPuzzleLines,
  normalizeActivityBookContent,
  isFillInBlankLine,
  isRuledWritingLine,
  detectAsciiPuzzleBlocks,
  countUnprocessedIllustrationMarkers,
} from "../shared/activityBookContent";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const rows = await c.query(`
  SELECT id, title, genre, status, length(content) as clen, content
  FROM draft_ebooks
  WHERE content IS NOT NULL AND length(content) > 500
  ORDER BY id
`);

type Issue = { id: number; title: string; genre: string; status: string; problems: string[] };

const issues: Issue[] = [];

for (const r of rows.rows) {
  if (!isActivityOrWorkbookGenre(r.genre)) continue;
  const content = r.content as string;
  const problems: string[] = [];

  const ascii = countAsciiPuzzleLines(content);
  const blocks = detectAsciiPuzzleBlocks(content).length;
  const normalized = normalizeActivityBookContent(content);
  const needsNormalize = normalized !== content;

  const lines = content.split("\n");
  const longBlanks = lines.filter((l) => isFillInBlankLine(l) || isRuledWritingLine(l)).length;
  const pendingMarkers = countUnprocessedIllustrationMarkers(content);

  if (ascii >= 2) problems.push(`${ascii} ASCII puzzle lines (${blocks} block(s))`);
  if (needsNormalize) problems.push("needs normalizeActivityBookContent");
  if (longBlanks > 8) problems.push(`${longBlanks} long fill-in/ruled lines`);
  if (pendingMarkers > 0) problems.push(`${pendingMarkers} pending illustration marker(s)`);

  if (problems.length) {
    issues.push({
      id: r.id,
      title: (r.title as string).slice(0, 50),
      genre: r.genre,
      status: r.status,
      problems,
    });
  }
}

console.log(`=== Activity/Workbook audit: ${issues.length} of ${rows.rows.filter((r) => isActivityOrWorkbookGenre(r.genre)).length} books with issues ===\n`);
for (const i of issues) {
  console.log(`#${i.id} [${i.status}] ${i.title}`);
  for (const p of i.problems) console.log(`   - ${p}`);
}

await c.end();
