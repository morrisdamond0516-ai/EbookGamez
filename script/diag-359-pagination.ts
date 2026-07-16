/**
 * Simulate reader pagination for draft content (mirrors book-reader splitIntoPages flags).
 */
import "./load-env.ts";
import fs from "fs";

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const { token } = (await login.json()) as { token: string };

// Import shared normalize + duplicate reader constants minimally
import { normalizeActivityBookContent, isActivityOrWorkbookGenre } from "../shared/activityBookContent.ts";

// Copy parseChapters from book-reader
function parseChapters(content: string) {
  const chapters: { number: number; title: string; content: string }[] = [];
  const lines = content.split("\n");
  let current: { number: number; title: string; content: string } | null = null;
  let buffer: string[] = [];
  const hasChapterHeadings = lines.some((l) => l.trim().match(/^#{1,2}\s*\**\s*Chapter\s+\d+/i));
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "---") continue;
    let chapterMatch =
      trimmed.match(/^#{1,2}\s*\**\s*(Chapter\s+\d+\s*[:—–\-].+?)\s*\**\s*$/i) ||
      trimmed.match(/^#{1,2}\s*\**\s*(Chapter\s+\d+)\s*\**\s*$/i);
    if (chapterMatch) {
      if (current) {
        current.content = buffer.join("\n").trim();
        chapters.push(current);
      }
      current = { number: chapters.length + 1, title: chapterMatch[1].replace(/\*+/g, "").trim(), content: "" };
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  if (current) {
    current.content = buffer.join("\n").trim();
    chapters.push(current);
  }
  return chapters;
}

function isWorkbookGenre(genre: string) {
  const SMALL_ILLUS_GENRES = ["Workbooks", "Activity Books", "Guided Journals"];
  return SMALL_ILLUS_GENRES.some((g) => genre.toLowerCase().includes(g.toLowerCase()));
}

function countIllusPages(chapterContent: string, genre: string) {
  const lines = chapterContent.split("\n");
  let illusOnlyPages = 0;
  let mixedPagesWithIllus = 0;
  let illusLines = 0;
  for (const line of lines) {
    if (/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\//i.test(line)) illusLines++;
  }
  // crude page simulation: illustration on own line => own page in full-page mode
  const small = isWorkbookGenre(genre);
  if (!small) {
    illusOnlyPages = illusLines; // full-page flush
  } else {
    mixedPagesWithIllus = illusLines; // shares pages
  }
  return { illusLines, smallIllustrations: small, illusOnlyPages, mixedPagesWithIllus };
}

for (const id of [359, 525]) {
  const d = (await (
    await fetch(`${BASE}/api/content-studio/drafts/${id}`, { headers: { "x-admin-token": token } })
  ).json()) as { genre: string; content: string; title: string };
  let content = d.content || "";
  if (isActivityOrWorkbookGenre(d.genre)) content = normalizeActivityBookContent(content);
  const chapters = parseChapters(content);
  const ch1 = chapters[0];
  const stats = countIllusPages(ch1?.content || "", d.genre);
  console.log(`\n#${id} genre=${d.genre} isWorkbookGenre=${isWorkbookGenre(d.genre)}`);
  console.log(`  ch1 illus lines=${stats.illusLines} smallIllustrations=${stats.smallIllustrations}`);
  console.log(`  chapters=${chapters.length}`);
  for (const ch of chapters.slice(0, 5)) {
    const s = countIllusPages(ch.content, d.genre);
    console.log(`  ${ch.title.slice(0, 40)}: ${s.illusLines} illus`);
  }
}
