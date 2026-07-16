/**
 * Restore Replit-finished library books to published + visible storefront.
 *
 *   npm run restore:library              (dry run — default)
 *   npm run restore:library -- --confirm (live restore)
 *   npm run restore:library -- --confirm --id 385 661 662
 *   npm run restore:library -- --confirm --include-research
 */
import "./load-env.ts";
import { restoreLibraryBooksToStorefront } from "../server/catalogRestore";

const args = process.argv.slice(2);
const dryRun = !args.includes("--confirm");
const includeResearchBatch = args.includes("--include-research");

const idIdx = args.indexOf("--id");
const draftIds =
  idIdx >= 0
    ? args
        .slice(idIdx + 1)
        .map((a) => parseInt(a, 10))
        .filter((n) => !Number.isNaN(n))
    : undefined;

console.log(
  `[restore-library] ${dryRun ? "DRY RUN (pass --confirm to apply)" : "LIVE — restoring storefront"}` +
    (includeResearchBatch ? " +research batch #707–728" : " (Replit library only)") +
    (draftIds?.length ? ` ids=${draftIds.join(",")}` : ""),
);

const { restored, results } = await restoreLibraryBooksToStorefront({
  dryRun,
  includeResearchBatch,
  draftIds,
});

console.log(`\n=== Summary: ${restored} book(s) would restore / restored ===\n`);
for (const r of results) {
  const pruned = r.pendingRemoved ? ` pruned=${r.pendingRemoved}` : "";
  console.log(`#${r.draftId} [${r.action}] book #${r.bookId} — ${r.note}${pruned} — ${r.title.slice(0, 55)}`);
}

if (dryRun && restored > 0) {
  console.log("\nRe-run with --confirm to publish drafts and set catalog visible=true.");
}
