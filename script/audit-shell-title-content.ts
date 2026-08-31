/**
 * Read-only audit: catalog title vs manuscript H1 for the six disputed shell titles.
 * Uses the same draft lookup as GET /api/books/:id/preview (draft.title = book.title).
 *
 * Run on Replit (production DATABASE_URL) for authoritative live results:
 *   npx tsx --import ./script/load-env.ts script/audit-shell-title-content.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { books, draftEbooks } from "../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import {
  extractFirstH1,
  normalizeTitle,
  isAcceptableTitleH1Variance,
} from "../server/titleMismatchUtils.ts";

const SHELL_TITLES = [
  {
    shellDraftId: 675,
    title: "The Complete Home Electrical Wiring Guide: Safe DIY from Outlets to Panels",
    expectedWrongH1: "Learning How to Learn: Science-Backed Strategies for Mastering Any Skill",
  },
  {
    shellDraftId: 670,
    title: "Boundaries Without Guilt: Protecting Your Peace in Every Relationship",
    expectedWrongH1: "The Shadow Work Journal: 90 Days of Deep Self-Discovery and Emotional Healing",
  },
  {
    shellDraftId: 671,
    title: "The Home Barista Handbook: Espresso, Latte Art, and Coffee Science",
    expectedWrongH1: "Words That Built Empires: 500 Quotes on Leadership, Strategy, and Power",
  },
  {
    shellDraftId: 672,
    title: "Fermentation at Home: Kombucha, Kimchi, Sourdough, and Beyond",
    expectedWrongH1: "How to Create Your Own Comic Book: From Concept to Published Issue",
  },
  {
    shellDraftId: 669,
    title: "The Communication Cure: Conflict Resolution Skills for Couples Who Actually Love Each Other",
    expectedWrongH1: "Introduction to Data Science with Python: From Statistics to Machine Learning",
  },
  {
    shellDraftId: 674,
    title: "The Vintage Home Revival: Thrifting, Upcycling, and Styling Secondhand Finds",
    expectedWrongH1: "The Ultimate Brain Games Collection: 500 Puzzles, Riddles, and Logic Challenges",
  },
] as const;

function matchLabel(catalogTitle: string, h1: string | null): "MATCH" | "MISMATCH" | "NO_H1" | "NO_CONTENT" {
  if (!h1) return "NO_H1";
  return isAcceptableTitleH1Variance(catalogTitle, h1) ? "MATCH" : "MISMATCH";
}

const dbHost = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "(no DATABASE_URL)";

console.log("\n=== Shell title vs manuscript H1 (read-only) ===");
console.log(`Database: ${dbHost}`);
console.log("Preview rule: first draft where draft.title = book.title and content length > 100\n");

let mismatchCount = 0;
let matchCount = 0;

for (const item of SHELL_TITLES) {
  console.log("=".repeat(72));
  console.log(`CATALOG TITLE: ${item.title}`);
  console.log(`Known shell draft id: #${item.shellDraftId}`);
  console.log(`Cursor previously saw wrong H1: ${item.expectedWrongH1.slice(0, 58)}…`);

  const catalogRows = await db
    .select({
      id: books.id,
      title: books.title,
      visible: books.visible,
      sourceDraftId: books.sourceDraftId,
    })
    .from(books)
    .where(eq(books.title, item.title));

  if (catalogRows.length === 0) {
    console.log("\n  Catalog: NOT FOUND with exact title");
  }

  for (const book of catalogRows) {
    console.log(`\n  Catalog book #${book.id} visible=${book.visible} source_draft_id=${book.sourceDraftId ?? "null"}`);

    // Same query as preview endpoint
    const [previewDraft] = await db
      .select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        status: draftEbooks.status,
        contentLen: sql<number>`length(coalesce(${draftEbooks.content}, ''))::int`,
        head: sql<string>`left(coalesce(${draftEbooks.content}, ''), 1200)`,
      })
      .from(draftEbooks)
      .where(
        and(
          eq(draftEbooks.title, book.title),
          sql`${draftEbooks.content} IS NOT NULL AND length(${draftEbooks.content}) > 100`,
        ),
      )
      .limit(1);

    if (!previewDraft || previewDraft.contentLen === 0) {
      console.log("  Preview draft: NONE (no content > 100 chars with matching title)");
      mismatchCount++;
      continue;
    }

    const h1 = extractFirstH1(previewDraft.head || "");
    const label = matchLabel(book.title, h1);
    if (label === "MATCH") matchCount++;
    else mismatchCount++;

    console.log(`  Preview draft: #${previewDraft.id} status=${previewDraft.status} content=${previewDraft.contentLen} chars`);
    console.log(`  Manuscript H1: ${h1 ?? "(none found)"}`);
    console.log(`  Result: ${label}`);

    if (label === "MISMATCH" && h1) {
      console.log(`  Normalized catalog: "${normalizeTitle(book.title).slice(0, 50)}…"`);
      console.log(`  Normalized H1:      "${normalizeTitle(h1).slice(0, 50)}…"`);
    }
  }

  // Shell draft row (Content Studio slot) — may differ from preview draft if multiple rows share title
  const [shellDraft] = await db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      status: draftEbooks.status,
      contentLen: sql<number>`length(coalesce(${draftEbooks.content}, ''))::int`,
      head: sql<string>`left(coalesce(${draftEbooks.content}, ''), 1200)`,
    })
    .from(draftEbooks)
    .where(eq(draftEbooks.id, item.shellDraftId))
    .limit(1);

  if (shellDraft) {
    const shellH1 = shellDraft.contentLen > 0 ? extractFirstH1(shellDraft.head || "") : null;
    const shellLabel =
      shellDraft.contentLen === 0
        ? "NO_CONTENT"
        : matchLabel(item.title, shellH1);
    console.log(`\n  Shell draft #${item.shellDraftId}: status=${shellDraft.status} content=${shellDraft.contentLen} chars`);
    console.log(`  Shell draft H1: ${shellH1 ?? "(none / empty)"}`);
    console.log(`  Shell draft vs title: ${shellLabel}`);
  } else {
    console.log(`\n  Shell draft #${item.shellDraftId}: NOT FOUND`);
  }

  // Any other drafts with same title?
  const sameTitleDrafts = await db
    .select({
      id: draftEbooks.id,
      status: draftEbooks.status,
      contentLen: sql<number>`length(coalesce(${draftEbooks.content}, ''))::int`,
      head: sql<string>`left(coalesce(${draftEbooks.content}, ''), 400)`,
    })
    .from(draftEbooks)
    .where(eq(draftEbooks.title, item.title));

  if (sameTitleDrafts.length > 1) {
    console.log(`\n  Other drafts with same stored title (${sameTitleDrafts.length} total):`);
    for (const d of sameTitleDrafts) {
      const h1 = d.contentLen > 100 ? extractFirstH1(d.head || "") : null;
      console.log(`    #${d.id} status=${d.status} len=${d.contentLen} h1="${h1?.slice(0, 45) ?? "(empty)"}"`);
    }
  }
}

console.log("\n" + "=".repeat(72));
console.log("SUMMARY (preview draft = what customers read via title match)");
console.log(`  MATCH: ${matchCount} catalog row(s)`);
console.log(`  MISMATCH / missing: ${mismatchCount} catalog row(s)`);
console.log("\nNo database changes were made.\n");

process.exit(0);
