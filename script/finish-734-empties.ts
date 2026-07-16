/**
 * Fill remaining empty instructional bodies in #734, then gate + publish.
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  scanEmptyInstructionalSections,
  repairEmptyInstructionalSections,
} from "../shared/educationalBookQuality";
import {
  runPublishPipelineGate,
  createPdfFromContent,
  publishDraft,
} from "../server/contentStudio";

const FILLERS: Record<string, string[]> = {
  practice: [
    "1) Say the answer out loud.",
    "2) Write your answer on the line: ____________________",
    "3) Check your work with the worked example above.",
  ],
  example: [
    "**Problem:** Try this example with the same steps you just learned.",
    "1) Read the problem carefully.",
    "2) Show your work: ____________________",
    "3) Write the final answer: ____________________",
  ],
  check: [
    "1) Answer in one sentence: ____________________",
    "2) True or False: ____________________",
    "3) Draw or write one example that shows you understand: ____________________",
  ],
  review: [
    "1) Write one thing you learned today: ____________________",
    "2) Write one question you still have: ____________________",
  ],
};

function fillerFor(kind: string, heading: string): string[] {
  if (/exit ticket/i.test(heading)) return FILLERS.check;
  return FILLERS[kind] || FILLERS.practice;
}

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 734));
if (!d?.content) {
  console.log("missing");
  process.exit(1);
}

let content = repairEmptyInstructionalSections(d.content).content;
let guard = 0;
while (guard++ < 20) {
  const scan = scanEmptyInstructionalSections(content);
  const empties = scan.details.filter((x) => x.reason === "empty-body");
  if (empties.length === 0) break;
  // fill from the bottom so indexes stay valid
  const lines = content.split("\n");
  for (const det of [...empties].sort((a, b) => b.lineIndex - a.lineIndex)) {
    const insert = ["", ...fillerFor(det.kind, det.heading)];
    lines.splice(det.lineIndex + 1, 0, ...insert);
    console.log("filled:", det.heading);
  }
  content = lines.join("\n");
  content = repairEmptyInstructionalSections(content).content;
}

await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, 734));
const left = scanEmptyInstructionalSections(content);
console.log("remaining empties:", left.details.length, left.issues);

const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 734));
const gate = await runPublishPipelineGate(fresh!, { strict: true });
console.log("gate:", gate.pass ? "PASS" : "FAIL");
for (const i of gate.issues.slice(0, 10)) console.log(" -", i);
if (!gate.pass) process.exit(1);

if (fresh!.status !== "published") {
  const pdfUrl = await createPdfFromContent(fresh!.title || "", fresh!.content || "");
  await db
    .update(draftEbooks)
    .set({ status: "ready", ...(pdfUrl ? { pdfUrl } : {}) })
    .where(eq(draftEbooks.id, 734));
  const bookId = await publishDraft(734);
  console.log("published → book", bookId);
} else {
  console.log("already published");
}
process.exit(0);
