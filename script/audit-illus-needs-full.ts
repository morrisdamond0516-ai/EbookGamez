import "./load-env.ts";
import { getIllustrationNeeds } from "../server/contentStudio";

const needs = await getIllustrationNeeds();
console.log(`=== getIllustrationNeeds(): ${needs.length} books ===\n`);

const byReason = new Map<string, number>();
for (const n of needs) {
  const key = n.reason.replace(/\d+/g, "N");
  byReason.set(key, (byReason.get(key) || 0) + 1);
}

console.log("By reason pattern:");
for (const [k, c] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}x  ${k}`);
}

console.log("\nAll flagged books:");
for (const n of needs.sort((a, b) => a.id - b.id)) {
  console.log(`  #${n.id} [${n.status}] ${n.genre.slice(0, 28).padEnd(28)} ${(n.title || "").slice(0, 42)}`);
  console.log(`         ${n.reason} (${n.actionType})`);
}

process.exit(0);
