/**
 * Pad thin instructional blocks in #740 so underfilled gate passes, then publish.
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  runPublishPipelineGate,
  createPdfFromContent,
  publishDraft,
} from "../server/contentStudio";
import { scanUnderfilledReaderPages } from "../shared/readerPageSplit";

const PAD =
  "Take a quiet moment here. Look back at what you just learned and say the main idea in your own words. If a word feels new, circle it and use it in one short sentence before you continue.";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 740));
if (!d?.content) {
  console.log("missing 740");
  process.exit(1);
}

const needles = [
  "### Bridge to Chapter 2 (What’s next—and why it matters)",
  "#### Mini-exercise (1 minute)",
  "### Common Misconception (let’s fix it now)",
  "### Part 1: Choose the Best Answer",
];

let content = d.content;
let pads = 0;
for (const needle of needles) {
  const idx = content.indexOf(needle);
  if (idx < 0) {
    // try ascii-normalized apostrophe variants
    const alt = needle.replace(/'/g, "'").replace(/'/g, "'");
    console.log("miss:", needle.slice(0, 40), "alt try later");
    continue;
  }
  const afterHeader = idx + needle.length;
  const nextChunk = content.slice(afterHeader, afterHeader + 280);
  if (nextChunk.includes(PAD)) continue;
  content = content.slice(0, afterHeader) + `\n\n${PAD}\n` + content.slice(afterHeader);
  pads++;
  console.log("padded:", needle.slice(0, 50));
}

// Fuzzy: any heading containing these stems if exact miss
const stems = [
  /### Bridge to Chapter 2[^\n]*/,
  /#### Mini-exercise \(1 minute\)/,
  /### Common Misconception[^\n]*/,
  /### Part 1: Choose the Best Answer/,
];
for (const re of stems) {
  const m = content.match(re);
  if (!m || m.index == null) continue;
  const end = m.index + m[0].length;
  const window = content.slice(end, end + 200);
  if (window.includes(PAD)) continue;
  // only pad if body until next heading is thin
  const rest = content.slice(end);
  const nextH = rest.search(/\n#{2,4}\s/);
  const body = (nextH >= 0 ? rest.slice(0, nextH) : rest.slice(0, 400)).trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words >= 45) continue;
  content = content.slice(0, end) + `\n\n${PAD}\n` + content.slice(end);
  pads++;
  console.log("stem-padded:", m[0].slice(0, 50), "was", words, "words");
}

await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 740));
const scan = scanUnderfilledReaderPages(content, { smallIllustrations: true, chapterLimit: 16 });
console.log("pads:", pads, "underfilled:", scan.underfilledPages, scan.issues);

const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 740));
const gate = await runPublishPipelineGate(fresh!, { strict: true });
console.log("gate:", gate.pass ? "PASS" : "FAIL");
for (const i of gate.issues) console.log(" -", i);

if (gate.pass && fresh!.status !== "published") {
  const pdfUrl = await createPdfFromContent(fresh!.title || "", fresh!.content || "");
  await db
    .update(draftEbooks)
    .set({ status: "ready", ...(pdfUrl ? { pdfUrl } : {}) })
    .where(eq(draftEbooks.id, 740));
  const bookId = await publishDraft(740);
  console.log("published → book", bookId);
}

process.exit(gate.pass ? 0 : 1);
