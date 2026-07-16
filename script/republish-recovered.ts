/**
 * Restore published status for demoted library books that still have covers + catalog rows.
 *
 * Run: npm run republish:recovered
 * Dry run: npm run republish:recovered -- --dry-run
 */
import "./load-env.ts";
import { republishReadyDraftsWithCatalogCovers } from "../server/coverRecovery";

const dryRun = process.argv.includes("--dry-run");
const result = await republishReadyDraftsWithCatalogCovers({ dryRun });

console.log(`\n[Republish] ${dryRun ? "Would restore" : "Restored"} ${result.republished} draft(s) to published.`);
if (result.drafts.length === 0) {
  console.log("No ready drafts with catalog matches and publishable covers found.");
}
