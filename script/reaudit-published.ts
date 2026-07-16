/**
 * Re-run the full publish pipeline gate on published drafts.
 *
 *   npm run reaudit:published
 *   npm run reaudit:published -- --min-id 726
 *   npm run reaudit:published -- --dry-run
 *   npm run reaudit:published -- --id 727 728
 *   npm run reaudit:published -- --dialogue   (optional paid dialogue review)
 */
import "./load-env.ts";
import { reauditPublishedDrafts } from "../server/contentStudio";

const args = process.argv.slice(2);
const dryRun = !args.includes("--confirm");
const confirm = args.includes("--confirm");
const verifyGenre = args.includes("--verify-genre");
const dialogueCheck = args.includes("--dialogue");

const minIdIdx = args.indexOf("--min-id");
const maxIdIdx = args.indexOf("--max-id");
const idIdx = args.indexOf("--id");

const minId = minIdIdx >= 0 ? parseInt(args[minIdIdx + 1], 10) : 726;
const maxId = maxIdIdx >= 0 ? parseInt(args[maxIdIdx + 1], 10) : undefined;
const draftIds =
  idIdx >= 0
    ? args
        .slice(idIdx + 1)
        .map((a) => parseInt(a, 10))
        .filter((n) => !Number.isNaN(n))
    : undefined;

console.log(
  `[reaudit-published] minId=${draftIds ? "(ids)" : minId}` +
    (maxId != null ? ` maxId=${maxId}` : "") +
    (dryRun ? " DRY RUN (default)" : " LIVE — will demote failures") +
    (verifyGenre ? " +genre verify" : "") +
    (dialogueCheck ? " +dialogue (paid API)" : " (free scan only)"),
);

if (!dryRun && !confirm) {
  console.error("Live demotion requires --confirm (run without it first to preview).");
  process.exit(1);
}

const result = await reauditPublishedDrafts({
  minId: draftIds ? undefined : minId,
  maxId,
  draftIds,
  dryRun,
  verifyGenre,
  dialogueCheck,
  confirmedAfterPreflight: confirm,
});

console.log("\n=== SUMMARY ===");
console.log(`Scanned: ${result.scanned}`);
console.log(`Passed:  ${result.passed}`);
console.log(`Failed:  ${result.failed}`);
console.log(`Demoted: ${result.demoted}${dryRun ? " (dry run)" : ""}`);

if (result.failed > 0) {
  console.log("\n=== FAILURES ===");
  for (const r of result.results.filter((x) => !x.pass)) {
    console.log(`#${r.id} ${r.title.slice(0, 50)}`);
    for (const issue of r.issues) console.log(`  - ${issue}`);
  }
}

process.exit(0);
