/**
 * Apply title collision repair for exact matches + user-approved near exceptions.
 *   node script/run-tsx.mjs script/apply-exact-title-repairs.ts
 *   node script/run-tsx.mjs script/apply-exact-title-repairs.ts --dry-run
 */
import "./load-env.ts";
import { resolveTitleCollisionAndRepublish } from "../server/titleCollisionRepair";

const DRY = process.argv.includes("--dry-run");

/** Exact collisions from filtered scan */
const EXACT_IDS = [
  215, 186, 37, 165, 31, 146, 164, 36, 162, 722, 148, 153, 717, 97, 250, 195,
  721, 20, 183, 719, 258, 265, 34, 172, 252, 221, 52, 227, 716,
];

/** User-approved near exceptions (+ Luna force case) */
const NEAR_EXCEPTION_IDS = [217, 139, 230, 149, 606, 724];

/** Drafts already renamed+cover-embedded this run; only need catalog sync on next pass */
const SKIP_IDS = new Set(
  process.argv.filter((a) => a.startsWith("--skip=")).flatMap((a) => a.slice(7).split(",").map(Number).filter(Boolean)),
);

const IDS = [...new Set([...EXACT_IDS, ...NEAR_EXCEPTION_IDS])].filter((id) => !SKIP_IDS.has(id));

async function main() {
  console.log(
    `Repairing ${IDS.length} drafts (${EXACT_IDS.length} exact + ${NEAR_EXCEPTION_IDS.length} near exceptions)`,
  );
  console.log("IDs:", IDS.join(", "));
  if (DRY) {
    console.log("Dry run only — no changes.");
    return;
  }

  let ok = 0;
  let fail = 0;
  let consecutiveSameFails = 0;
  let lastFailSig = "";

  for (const id of IDS) {
    console.log(`\n=== #${id} ===`);
    try {
      const result = await resolveTitleCollisionAndRepublish(id, { forceRename: true });
      console.log(`OK: "${result.oldTitle}" → "${result.newTitle}"`);
      for (const s of result.steps) console.log(`  - ${s}`);
      ok++;
      consecutiveSameFails = 0;
      lastFailSig = "";
    } catch (e: any) {
      const msg = e?.message || String(e);
      const cause = e?.cause?.message || e?.code || "";
      console.error(`FAIL #${id}: ${msg}${cause ? ` (${cause})` : ""}`);
      fail++;
      const sig = `${msg}`.slice(0, 120);
      if (sig === lastFailSig || /connection|fetch failed|ECONNRESET|ETIMEDOUT|socket|unsupported_parameter/i.test(`${msg} ${cause}`)) {
        consecutiveSameFails = sig === lastFailSig ? consecutiveSameFails + 1 : consecutiveSameFails + 1;
        lastFailSig = sig;
        if (consecutiveSameFails >= 2) {
          console.error(
            "\nSTOP: two consecutive identical/connection failures — diagnose before more spend.",
          );
          break;
        }
      } else {
        consecutiveSameFails = 1;
        lastFailSig = sig;
      }
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail} remaining_untried=${IDS.length - ok - fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
