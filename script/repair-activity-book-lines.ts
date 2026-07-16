/**
 * Repair ASCII puzzle lines in activity/workbook books.
 * Converts text grids to [ILLUSTRATION:] markers and optionally regenerates images.
 *
 * Usage:
 *   npx tsx script/repair-activity-book-lines.ts
 *   npx tsx script/repair-activity-book-lines.ts --id 728 --regen
 *   npx tsx script/repair-activity-book-lines.ts --all --regen
 */
import "./load-env.ts";
import {
  repairAllActivityBookLines,
} from "../server/contentStudio";

async function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const draftId = idIdx >= 0 ? Number(args[idIdx + 1]) : undefined;
  const all = args.includes("--all");
  const regen = args.includes("--regen");
  const linesOnly = args.includes("--lines-only");

  if (draftId && !Number.isNaN(draftId)) {
    const { repairActivityBookLinesForDraft } = await import("../server/contentStudio");
    const result = await repairActivityBookLinesForDraft(draftId, { convertAscii: !linesOnly });
    console.log(JSON.stringify(result, null, 2));
    if (regen && result.unprocessedMarkers > 0) {
      await repairAllActivityBookLines({
        draftIds: [draftId],
        regenerateIllustrations: true,
      });
      console.log("Illustration regeneration queued for draft", draftId);
    }
    return;
  }

  if (!all) {
    console.log("Scanning all activity/workbook drafts with ASCII puzzle lines...");
  } else if (!args.includes("--confirm-library")) {
    console.error(
      "Refusing --all without --confirm-library.\n" +
        "Run with --dry-run first to see preflight, then --all --confirm-library.\n" +
        "Or target one book: --id 728",
    );
    process.exit(1);
  }

  const results = await repairAllActivityBookLines({
    regenerateIllustrations: regen,
    convertAscii: !linesOnly,
    dryRun: args.includes("--dry-run"),
    confirmedAfterPreflight: args.includes("--confirm-library"),
  });
  console.log(`Repaired ${results.length} draft(s):`);
  for (const r of results) {
    console.log(`  #${r.draftId} ${r.title}: ${r.asciiBlocksReplaced} block(s), ${r.asciiLinesBefore}→${r.asciiLinesAfter} lines`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
