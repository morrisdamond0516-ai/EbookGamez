/**
 * Repair AI-authored drafts whose titles collide with external books:
 * rename → regen cover (same style path) → republish.
 *
 *   node script/run-tsx.mjs script/repair-title-collisions.ts --dry-run
 *   node script/run-tsx.mjs script/repair-title-collisions.ts --apply
 *   node script/run-tsx.mjs script/repair-title-collisions.ts --apply --title "Luna and the Starwhale"
 *
 * Classics (genre starts with Classic) are skipped.
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq, ilike, and, ne, sql } from "drizzle-orm";
import { checkTitleOriginality, isClassicOrPublicDomainGenre } from "../server/titleOriginality";
import { resolveTitleCollisionAndRepublish } from "../server/titleCollisionRepair";

const APPLY = process.argv.includes("--apply");
const titleArgIdx = process.argv.indexOf("--title");
const titleFilter = titleArgIdx >= 0 ? process.argv[titleArgIdx + 1] : null;

/** Known problem titles from originality audit + Luna brand collision. */
const KNOWN_FORCE = new Set(
  [
    "Luna and the Starwhale",
    "AI Rebellion",
    "Cosmic Dread",
    "Forgotten Rebels",
    "Reservoir of Secrets",
    "The Labyrinth of Lies",
    "The Forgotten Realms",
    "Phantom Echoes",
    "Quantum Awakenings",
    "Cryptid Chronicles",
  ].map((t) => t.toLowerCase()),
);

async function main() {
  let drafts;
  if (titleFilter) {
    drafts = await db
      .select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        status: draftEbooks.status,
        coverStyleId: draftEbooks.coverStyleId,
      })
      .from(draftEbooks)
      .where(ilike(draftEbooks.title, `%${titleFilter}%`));
  } else if (process.argv.includes("--scan-all")) {
    drafts = await db
      .select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        status: draftEbooks.status,
        coverStyleId: draftEbooks.coverStyleId,
      })
      .from(draftEbooks)
      .where(
        and(
          ne(draftEbooks.status, "idea"),
          sql`${draftEbooks.title} IS NOT NULL`,
        ),
      );
  } else {
    // Default: only the known collision watchlist (fast, production-safe)
    const known = [...KNOWN_FORCE];
    drafts = [];
    for (const t of known) {
      const rows = await db
        .select({
          id: draftEbooks.id,
          title: draftEbooks.title,
          genre: draftEbooks.genre,
          status: draftEbooks.status,
          coverStyleId: draftEbooks.coverStyleId,
        })
        .from(draftEbooks)
        .where(ilike(draftEbooks.title, t));
      drafts.push(...rows);
    }
  }

  const targets: { id: number; title: string; genre: string | null; force: boolean }[] = [];

  for (const d of drafts) {
    if (!d.title) continue;
    if (isClassicOrPublicDomainGenre(d.genre)) continue;
    const force = KNOWN_FORCE.has(d.title.trim().toLowerCase());
    if (force) {
      targets.push({ id: d.id, title: d.title, genre: d.genre, force: true });
      continue;
    }
    if (titleFilter) {
      // Explicit --title: only rename if on watchlist or external check fails
      if (force || !(await checkTitleOriginality(d.title, { genre: d.genre })).ok) {
        targets.push({ id: d.id, title: d.title, genre: d.genre, force: true });
      }
      continue;
    }
    const check = await checkTitleOriginality(d.title, { genre: d.genre });
    if (!check.ok) {
      targets.push({ id: d.id, title: d.title, genre: d.genre, force: false });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`Found ${targets.length} draft(s) to repair:\n`);
  for (const t of targets) {
    console.log(`  #${t.id} [${t.force ? "force" : "hit"}] ${t.title}`);
  }

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to rename + regen covers + republish.`);
    return;
  }

  for (const t of targets) {
    console.log(`\n=== Repairing #${t.id} "${t.title}" ===`);
    try {
      const result = await resolveTitleCollisionAndRepublish(t.id, {
        forceRename: t.force,
      });
      console.log(`OK: "${result.oldTitle}" → "${result.newTitle}"`);
      for (const s of result.steps) console.log(`  - ${s}`);
    } catch (e: any) {
      const cause = e?.cause?.message || e?.code || "";
      console.error(`FAIL #${t.id}: ${e?.message || e}${cause ? ` (${cause})` : ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
