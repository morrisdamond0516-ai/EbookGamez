import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq } from "drizzle-orm";
import { runPublishPipelineGate } from "../server/contentStudio";
import { assessDraftCompleteness } from "../server/batchOperationGuards";
import { draftHasPublishableCover } from "../server/coverStorage";
import { countAsciiPuzzleLines, countResolvedIllustrationMarkers } from "@shared/activityBookContent";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 525));
if (!d) {
  console.log("Draft 525 not found");
  process.exit(1);
}
const [b] = await db.select().from(books).where(eq(books.id, 462));

console.log("=== Draft #525 ===");
console.log("status:", d.status);
console.log("genre:", d.genre);
console.log("cover ok:", draftHasPublishableCover(d));
console.log("published_at:", d.publishedAt);
console.log("words:", (d.content || "").split(/\s+/).length);
console.log("resolved illus:", countResolvedIllustrationMarkers(d.content || ""));
console.log("ascii lines:", countAsciiPuzzleLines(d.content || ""));

const chapters = [...(d.content || "").matchAll(/##\s*Chapter\s+(\d+)/gi)];
for (let i = 0; i < chapters.length; i++) {
  const chNum = parseInt(chapters[i][1], 10);
  const start = chapters[i].index!;
  const end = i + 1 < chapters.length ? chapters[i + 1].index! : (d.content || "").length;
  const chText = (d.content || "").slice(start, end);
  const resolved = (chText.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  const ascii = countAsciiPuzzleLines(chText);
  if (resolved === 0 || ascii > 0) {
    console.log(`  Ch${chNum}: ${resolved} illus, ${ascii} ascii lines`);
  }
}

console.log("\n=== Catalog #462 ===");
console.log("visible:", b?.visible, "title:", b?.title?.slice(0, 60));

const gate = await runPublishPipelineGate(d, { verifyGenre: false, dialogueCheck: false });
console.log("\n=== Quality gate ===");
console.log("pass:", gate.pass);
for (const issue of gate.issues) console.log(" -", issue);

const a = assessDraftCompleteness(d);
console.log("\nlibraryComplete:", a.libraryComplete);
console.log("signals:", a.signals.join("; "));
