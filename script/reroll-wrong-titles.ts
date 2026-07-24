/**
 * Re-roll titles that drifted from the manuscript (content-aware rename).
 *   node script/run-tsx.mjs script/reroll-wrong-titles.ts
 */
import "./load-env.ts";
import { resolveTitleCollisionAndRepublish } from "../server/titleCollisionRepair";

/** Titles that clearly don't match the book */
const WRONG_IDS = [
  31, // Cosmic Dread → Pantry Rifts… (domestic pantry vs cosmic/horror intent)
  97, // Reservoir of Secrets → Backyard Regen Blueprint… (how-to gardening tone on a thriller)
];

async function main() {
  console.log(`Re-rolling ${WRONG_IDS.length} off-premise titles with manuscript scan…`);
  let ok = 0;
  let fail = 0;
  for (const id of WRONG_IDS) {
    console.log(`\n=== #${id} ===`);
    try {
      const result = await resolveTitleCollisionAndRepublish(id, { forceRename: true });
      console.log(`OK: "${result.oldTitle}" → "${result.newTitle}"`);
      for (const s of result.steps) console.log(`  - ${s}`);
      ok++;
    } catch (e: any) {
      console.error(`FAIL #${id}: ${e?.message || e}`);
      fail++;
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
