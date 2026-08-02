/**
 * titleMismatchHandler.ts
 *
 * Extracted core logic for GET /api/content-studio/title-mismatches so it can
 * be unit-tested independently of the full Express app setup.
 *
 * The handler:
 *  1. Fetches all drafts that have non-empty content.
 *  2. Extracts the first H1 from each draft's content (markdown or HTML).
 *  3. Skips drafts with no H1 (no mismatch possible).
 *  4. Compares the stored title to the H1 using case/whitespace normalization.
 *  5. Returns the list of mismatches and a count.
 */

import { sql } from "drizzle-orm";
import { draftEbooks } from "@shared/schema";
import { extractFirstH1, normalizeTitle } from "./titleMismatchUtils";

export interface TitleMismatchDeps {
  /** Drizzle DB instance (or compatible duck-type). */
  db: {
    select: (fields?: any) => any;
  };
}

export interface TitleMismatch {
  id: number;
  storedTitle: string;
  contentH1: string;
}

export interface TitleMismatchResult {
  mismatches: TitleMismatch[];
  count: number;
}

/**
 * Core handler: scans all non-empty drafts and returns those where the stored
 * title does not match the first H1 in the content.
 */
export async function getTitleMismatches(
  deps: TitleMismatchDeps,
): Promise<TitleMismatchResult> {
  const drafts = await deps.db
    .select({ id: draftEbooks.id, title: draftEbooks.title, content: draftEbooks.content })
    .from(draftEbooks)
    .where(sql`${draftEbooks.content} IS NOT NULL AND trim(${draftEbooks.content}) != ''`);

  const mismatches: TitleMismatch[] = [];

  for (const draft of drafts) {
    if (!draft.content) continue;
    const h1 = extractFirstH1(draft.content);
    if (!h1) continue;
    if (normalizeTitle(draft.title) !== normalizeTitle(h1)) {
      mismatches.push({ id: draft.id, storedTitle: draft.title, contentH1: h1 });
    }
  }

  return { mismatches, count: mismatches.length };
}
