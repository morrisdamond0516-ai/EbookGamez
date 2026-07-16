/**
 * Find existing covers on production/catalog and mark drafts satisfied (regen deferred).
 * No new AI cover spend — restores URLs, optional local download, republishes demoted books.
 *
 * Run: npm run recover:covers
 * Dry run: npm run recover:covers -- --dry-run
 * Specific IDs: npm run recover:covers -- --ids=646,648,707
 */
import "./load-env.ts";
import { recoverExistingCovers } from "../server/coverRecovery";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const idsArg = args.find((a) => a.startsWith("--ids="));
const draftIds = idsArg
  ? idsArg
      .slice("--ids=".length)
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n))
  : undefined;

console.log(`[Recover Covers] ${dryRun ? "DRY RUN — " : ""}scanning ready + published drafts...`);
const results = await recoverExistingCovers({ draftIds, dryRun });

const byAction = {
  recovered: results.filter((r) => r.action === "recovered"),
  deferred: results.filter((r) => r.action === "deferred"),
  skipped: results.filter((r) => r.action === "skipped"),
  failed: results.filter((r) => r.action === "failed"),
};

for (const r of results) {
  const icon =
    r.action === "recovered" ? "✓" : r.action === "deferred" ? "↗" : r.action === "skipped" ? "·" : "✗";
  console.log(
    `  ${icon} #${r.draftId} ${r.title} [${r.action}]${r.coverUrl ? ` ${r.coverUrl}` : ""}${r.note ? ` — ${r.note}` : ""}`,
  );
}

console.log(
  `\n[Recover Covers] Done: ${byAction.recovered.length} local file restored, ` +
    `${byAction.deferred.length} deferred (production URL), ` +
    `${byAction.skipped.length} skipped, ${byAction.failed.length} failed`,
);

if (byAction.failed.length > 0) process.exit(1);
