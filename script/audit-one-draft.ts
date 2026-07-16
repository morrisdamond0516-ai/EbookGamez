import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  runPublishPipelineGate,
  scanContentCompleteness,
  getVisualPublishBlockers,
  createPdfFromContent,
} from "../server/contentStudio";
import { assessDraftCompleteness } from "../server/batchOperationGuards";
import { draftHasPublishableCover } from "../server/coverStorage";
import {
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
} from "@shared/activityBookContent";

const id = parseInt(process.argv[2] || "708", 10);
const promote = process.argv.includes("--promote");
const structuralOnly = process.argv.includes("--structural-only");
const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
if (!d) {
  console.log(`Draft #${id} not found`);
  process.exit(1);
}

const c = d.content || "";
const [book] = await db
  .select()
  .from(books)
  .where(eq(books.sourceDraftId, id));

console.log(`=== #${id} ${d.title} ===`);
console.log("status:", d.status);
console.log("genre:", d.genre);
console.log("cover ok:", draftHasPublishableCover(d));
console.log("cover_style_id:", d.coverStyleId);
console.log("cover:", (d.coverUrl || d.backgroundUrl || "none").slice(0, 80));
console.log("catalog:", book ? `#${book.id} visible=${book.visible}` : "none");
console.log("words:", c.split(/\s+/).length);
console.log("chapters:", (c.match(/##\s*Chapter\s+\d+/gi) || []).length);
console.log("outline chars:", (d.outline || "").length);
console.log("resolved illus:", countResolvedIllustrationMarkers(c));
console.log("pending illus:", countUnprocessedIllustrationMarkers(c));
console.log("pdf:", !!d.pdfUrl);

const visual = getVisualPublishBlockers(c, d.genre);
console.log("\nVisual blockers:", visual.length ? visual.join("\n  ") : "none");

const a = assessDraftCompleteness(d);
console.log("\nCompleteness:", a.libraryComplete ? "library-complete" : "incomplete");
console.log("signals:", a.signals.join("; ") || "(none)");
if (a.illustrationQueueNeeded) console.log("illustration queue:", a.illustrationQueueReason);

const scan = await scanContentCompleteness([id]);
const issues = scan[0]?.issues || [];
console.log("\nStructural / illustration issues:", issues.length ? "" : "none");
for (const issue of issues) console.log("  -", issue);

const gate = await runPublishPipelineGate(
  d,
  structuralOnly ? { verifyGenre: false, dialogueCheck: false } : { strict: true },
);
console.log("\nQuality gate:", structuralOnly ? "(structural only) " : "(strict) ", gate.pass ? "PASS" : "FAIL");
for (const issue of gate.issues) console.log("  -", issue);

if (promote && gate.pass && d.status !== "ready" && d.status !== "published") {
  await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, id));
  const pdfUrl = await createPdfFromContent(d.title || "", c);
  await db.update(draftEbooks).set({ pdfUrl }).where(eq(draftEbooks.id, id));
  console.log("\nPromoted to ready" + (pdfUrl ? " (PDF created)" : ""));
} else if (promote && !gate.pass) {
  console.log("\n--promote skipped: quality gate failed");
}

if (!c.trim() || c.trim().length < 500) {
  console.log("\nContent preview (empty/short):", c.slice(0, 300));
} else if (d.status === "draft" && !d.outline?.trim()) {
  console.log("\nLikely blocker: no outline — needs content generation first");
} else if (d.status === "draft" && c.split(/\s+/).length < 1000) {
  console.log("\nLikely blocker: partial content — needs continue writing or full generation");
}
