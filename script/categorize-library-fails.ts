/** Categorize structural gate failures — read only, no AI. */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { runPublishPipelineGate } from "../server/contentStudio";

const drafts = await db.select().from(draftEbooks);
const themes = new Map<string, number>();
const failIds: number[] = [];
let fail = 0;
let pass = 0;

for (const d of drafts) {
  const words = (d.content || "").split(/\s+/).length;
  if (words <= 500) continue;
  const gate = await runPublishPipelineGate(d, { verifyGenre: false, dialogueCheck: false });
  if (gate.pass) {
    pass++;
    continue;
  }
  fail++;
  failIds.push(d.id);
  for (const iss of gate.issues) {
    let theme = "other";
    if (/illustration|ILLUSTRATION|visual|pending/i.test(iss)) theme = "missing / pending illustrations";
    else if (/cover/i.test(iss)) theme = "cover";
    else if (/placeholder|too short|truncated|TBC|missing chapter|duplicate|stub/i.test(iss))
      theme = "content structure";
    else if (/outline/i.test(iss)) theme = "outline";
    themes.set(theme, (themes.get(theme) || 0) + 1);
  }
}

console.log("\n=== Failure theme counts (issue occurrences) ===");
for (const [k, v] of [...themes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v}× ${k}`);
}
console.log(`\nBooks: pass=${pass} fail=${fail}`);
console.log(`Fail IDs (first 60): ${failIds.slice(0, 60).join(", ")}`);
