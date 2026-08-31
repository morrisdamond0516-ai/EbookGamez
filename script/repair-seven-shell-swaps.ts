/**
 * Repair 6 shell drafts whose title/cover/outline match the shell but dialogue
 * is a different book. The correct manuscripts already exist under other draft IDs.
 *
 * Actions (6 swaps only — #699 Mastering Micro handled separately):
 *   1. Hide catalog row (books.visible = false)
 *   2. Clear wrong content; keep outline + cover
 *   3. Demote draft → status=draft, published_at=NULL
 *
 * Usage:
 *   npx tsx --import ./script/load-env.ts script/repair-seven-shell-swaps.ts
 *   npx tsx --import ./script/load-env.ts script/repair-seven-shell-swaps.ts --apply
 *   npx tsx --import ./script/load-env.ts script/repair-seven-shell-swaps.ts --apply --start-write
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { extractFirstH1 } from "../server/titleMismatchUtils.ts";
import { generateContentForDraft } from "../server/contentStudio.ts";
import { draftHasPublishableCover } from "../server/coverStorage.ts";

const dryRun = !process.argv.includes("--apply");
const startWrite = process.argv.includes("--start-write");

/** Known live catalog rows for shell titles (title-match verification). */
const EXPECTED_CATALOG: Record<number, number> = {
  675: 665,
  670: 600,
  671: 605,
  672: 611,
  669: 596,
  674: 653,
};
const SHELL_SWAPS = [
  { shellId: 675, correctId: 653, label: "Electrical Wiring → Learning How to Learn" },
  { shellId: 670, correctId: 687, label: "Boundaries → Shadow Work Journal" },
  { shellId: 671, correctId: 689, label: "Barista → Words That Built Empires" },
  { shellId: 672, correctId: 692, label: "Fermentation → Comic Book" },
  { shellId: 669, correctId: 685, label: "Communication Cure → Data Science Python" },
  { shellId: 674, correctId: 694, label: "Vintage Home → Brain Games" },
] as const;

/** Same book, shortened H1 — align stored title to H1; do not clear content. */
const MASTERING_MICRO = { id: 699, h1Title: "Mastering Micro" };

async function main() {
  console.log(`\n=== Repair seven shell title/body swaps ===`);
  console.log({ dryRun, startWrite, db: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") });

  const shellIds = SHELL_SWAPS.map((s) => s.shellId);
  const allIds = [...shellIds, MASTERING_MICRO.id, ...SHELL_SWAPS.map((s) => s.correctId)];

  const rows = await db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      status: draftEbooks.status,
      publishedAt: draftEbooks.publishedAt,
      content: draftEbooks.content,
      outline: draftEbooks.outline,
      coverUrl: draftEbooks.coverUrl,
      backgroundUrl: draftEbooks.backgroundUrl,
    })
    .from(draftEbooks)
    .where(inArray(draftEbooks.id, allIds));

  const byId = new Map(rows.map((r) => [r.id, r]));

  console.log("\n--- Preflight ---");
  for (const s of SHELL_SWAPS) {
    const shell = byId.get(s.shellId);
    const correct = byId.get(s.correctId);
    if (!shell) {
      console.error(`MISSING shell #${s.shellId}`);
      process.exit(1);
    }
    const h1 = extractFirstH1((shell.content || "").slice(0, 600));
    const correctH1 = correct ? extractFirstH1((correct.content || "").slice(0, 600)) : null;
    console.log(`#${s.shellId} shell="${(shell.title || "").slice(0, 45)}" h1="${h1?.slice(0, 40)}"`);
    console.log(`  correct #${s.correctId} status=${correct?.status} h1="${correctH1?.slice(0, 40)}" (${s.label})`);
  }

  const queued: number[] = [];
  let hidden = 0;
  let cleared = 0;
  let demoted = 0;

  console.log("\n--- Repair 6 shell swaps ---");
  for (const s of SHELL_SWAPS) {
    const shell = byId.get(s.shellId)!;
    const outlineLen = (shell.outline || "").length;
    const hasCover = draftHasPublishableCover(shell);

    // Match catalog by source_draft_id, else exact title (never book.id === draft.id).
    const [bySource] = await db
      .select({ id: books.id, title: books.title, visible: books.visible, sourceDraftId: books.sourceDraftId })
      .from(books)
      .where(eq(books.sourceDraftId, s.shellId))
      .limit(1);

    let catalog = bySource;
    if (!catalog && shell.title) {
      const [byTitle] = await db
        .select({ id: books.id, title: books.title, visible: books.visible, sourceDraftId: books.sourceDraftId })
        .from(books)
        .where(eq(books.title, shell.title))
        .limit(1);
      catalog = byTitle;
    }

    if (catalog && EXPECTED_CATALOG[s.shellId] && catalog.id !== EXPECTED_CATALOG[s.shellId]) {
      console.error(`  ABORT: catalog #${catalog.id} != expected #${EXPECTED_CATALOG[s.shellId]}`);
      process.exit(1);
    }

    console.log(`\n#${s.shellId} ${(shell.title || "").slice(0, 50)}`);
    console.log(`  outline=${outlineLen} chars cover=${hasCover} catalog=#${catalog?.id ?? "none"} visible=${catalog?.visible ?? "n/a"}`);

    if (!dryRun) {
      await db
        .update(draftEbooks)
        .set({
          content: null,
          status: "draft",
          publishedAt: null,
          pdfUrl: null,
        })
        .where(eq(draftEbooks.id, s.shellId));
      cleared++;

      if (catalog) {
        await db.update(books).set({ visible: false }).where(eq(books.id, catalog.id));
        hidden++;
        console.log(`  → hid catalog #${catalog.id}`);
      }

      demoted++;
      if (hasCover && outlineLen > 200) {
        queued.push(s.shellId);
      } else {
        console.log(`  → skip write queue (need cover + outline)`);
      }
    } else {
      console.log(`  [dry-run] would clear content, demote, hide catalog`);
      if (hasCover && outlineLen > 200) queued.push(s.shellId);
    }
  }

  console.log("\n--- Fix #699 Mastering Micro (title ↔ H1 only) ---");
  const micro = byId.get(MASTERING_MICRO.id);
  if (micro) {
    const h1 = extractFirstH1((micro.content || "").slice(0, 600));
    console.log(`#699 stored="${(micro.title || "").slice(0, 50)}" h1="${h1}"`);
    if (!dryRun && h1 && micro.title !== h1) {
      await db.update(draftEbooks).set({ title: h1, topic: h1 }).where(eq(draftEbooks.id, MASTERING_MICRO.id));
      const [cat] = await db.select().from(books).where(eq(books.sourceDraftId, MASTERING_MICRO.id)).limit(1);
      if (cat && cat.title !== h1) {
        await db.update(books).set({ title: h1 }).where(eq(books.id, cat.id));
        console.log(`  → aligned catalog #${cat.id} title to "${h1}"`);
      }
      console.log(`  → aligned draft title to H1 (content kept — only copy)`);
    } else if (dryRun && h1 && micro.title !== h1) {
      console.log(`  [dry-run] would set draft.title = "${h1}"`);
    } else {
      console.log(`  no title change needed`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log({ dryRun, cleared, demoted, catalogHidden: hidden, queuedForWrite: queued, ids: queued });

  if (!dryRun && startWrite && queued.length > 0) {
    console.log(`\nStarting sequential generateContentForDraft for ${queued.length} shells...\n`);
    let transportFails = 0;
    for (const id of queued) {
      const row = byId.get(id);
      console.log(`\n----- generateContentForDraft(${id}) ${row?.title?.slice(0, 40)} -----`);
      try {
        await generateContentForDraft(id);
        transportFails = 0;
        console.log(`OK #${id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`FAIL #${id}:`, msg);
        if (/connection error|fetch failed|socket|UND_ERR/i.test(msg)) {
          transportFails++;
          if (transportFails >= 2) {
            console.error("Stopped after 2 transport failures.");
            process.exit(1);
          }
        }
      }
    }
  } else if (queued.length > 0 && !startWrite) {
    console.log(
      `\nShells queued as draft with outline+cover intact. Start writing:\n` +
        `  Content Studio → select IDs ${queued.join(", ")}\n` +
        `  or: npx tsx --import ./script/load-env.ts script/repair-seven-shell-swaps.ts --apply --start-write`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
