import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { getIllustrationNeeds, runPublishPipelineGate } from "../server/contentStudio";
import {
  countUnprocessedIllustrationMarkers,
  countResolvedIllustrationMarkers,
  draftNeedsIllustrationQueueEntry,
} from "../shared/activityBookContent";
import { assessDraftCompleteness } from "../server/batchOperationGuards";

const needs = await getIllustrationNeeds();
console.log(`getIllustrationNeeds: ${needs.length}\n`);

const all = await db.select().from(draftEbooks);
const published = all.filter((d) => d.status === "published");
console.log(`Total drafts: ${all.length}, published: ${published.length}\n`);

console.log("=== Published books that would STILL appear in illustration queue ===");
let pubInQueue = 0;
for (const d of published) {
  if (needs.some((n) => n.id === d.id)) {
    pubInQueue++;
    const n = needs.find((x) => x.id === d.id)!;
    console.log(`  #${d.id} [${d.genre}] ${(d.title || "").slice(0, 50)} — ${n.reason}`);
  }
}
console.log(`Count: ${pubInQueue}\n`);

console.log("=== Published visual books with pending markers (even if not in queue) ===");
for (const d of published) {
  const content = d.content || "";
  const pending = countUnprocessedIllustrationMarkers(content);
  const resolved = countResolvedIllustrationMarkers(content);
  if (pending > 0) {
    const queue = draftNeedsIllustrationQueueEntry(content, d.genre);
    const complete = assessDraftCompleteness(d);
    console.log(
      `  #${d.id} pending=${pending} resolved=${resolved} queue=${queue.needs} libraryComplete=${complete.libraryComplete} — ${(d.title || "").slice(0, 45)}`,
    );
  }
}

console.log("\n=== Restored batch (385,661,662,727,728) pipeline gate ===");
for (const id of [385, 661, 662, 727, 728]) {
  const d = all.find((x) => x.id === id);
  if (!d) continue;
  const gate = await runPublishPipelineGate(d);
  const inQueue = needs.some((n) => n.id === id);
  console.log(
    `  #${id} status=${d.status} inIllusQueue=${inQueue} gatePass=${gate.pass}` +
      (gate.issues.length ? ` issues: ${gate.issues.slice(0, 2).join("; ")}` : ""),
  );
}

console.log("\n=== Naive count: visual genre + any pending text marker ===");
function isVisualGenre(g: string | null | undefined): boolean {
  const gl = (g || "").toLowerCase();
  return (
    gl.includes("coloring") ||
    gl.includes("activity") ||
    gl.includes("workbook") ||
    gl.includes("children") ||
    gl.includes("journal") ||
    gl.includes("comic")
  );
}
let naive = 0;
for (const d of all) {
  if (!isVisualGenre(d.genre)) continue;
  const p = countUnprocessedIllustrationMarkers(d.content || "");
  if (p > 0) {
    naive++;
    console.log(`  #${d.id} [${d.status}] pending=${p} — ${(d.title || "").slice(0, 45)}`);
  }
}
console.log(`Total: ${naive}`);
