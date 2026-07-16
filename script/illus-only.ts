/** Run illustrations-only for specific draft IDs (no content rewrite). */
import "./load-env.ts";
import { generateIllustrationsOnly } from "../server/contentStudio";

const ids = process.argv.slice(2).map((a) => parseInt(a, 10)).filter((n) => !Number.isNaN(n));
if (ids.length === 0) {
  console.error("Usage: npx tsx script/illus-only.ts 727");
  process.exit(1);
}

console.log(`Starting illustrations-only for: ${ids.join(", ")}`);
await generateIllustrationsOnly(ids);
console.log("Done (batch runs in background until images finish).");
