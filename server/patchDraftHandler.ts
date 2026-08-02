/**
 * patchDraftHandler.ts
 *
 * Extracted core logic for PATCH /api/content-studio/drafts/:id so it can
 * be unit-tested independently of the full Express app setup.
 *
 * The handler:
 *  1. Validates the draft ID is a valid integer.
 *  2. Confirms the draft exists in the database.
 *  3. Validates any provided fields (title, suggestedPrice, genre).
 *  4. Applies the updates and returns the updated draft.
 */

import { eq } from "drizzle-orm";
import { draftEbooks } from "@shared/schema";

export interface PatchDraftDeps {
  /** Drizzle DB instance (or compatible duck-type). */
  db: {
    select: (fields?: any) => any;
    update: (table: any) => any;
  };
}

export type PatchDraftError =
  | { kind: "invalid_id" }
  | { kind: "not_found" }
  | { kind: "invalid_title" }
  | { kind: "invalid_price" }
  | { kind: "invalid_genre" }
  | { kind: "no_fields" };

export type PatchDraftOutcome =
  | { ok: true; draft: Record<string, any> }
  | { ok: false; error: PatchDraftError };

/**
 * Core handler: validates and applies a partial update to a draft ebook.
 *
 * @param rawId   - The raw `:id` route parameter (string).
 * @param body    - The request body (may contain title, suggestedPrice, genre).
 * @param deps    - Injected database dependency.
 */
export async function patchDraft(
  rawId: string,
  body: { title?: unknown; suggestedPrice?: unknown; genre?: unknown },
  deps: PatchDraftDeps,
): Promise<PatchDraftOutcome> {
  const draftId = parseInt(rawId, 10);
  if (isNaN(draftId)) {
    return { ok: false, error: { kind: "invalid_id" } };
  }

  // Check if draft exists
  const [existing] = await deps.db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!existing) {
    return { ok: false, error: { kind: "not_found" } };
  }

  const { title, suggestedPrice, genre } = body;

  // Validate inputs
  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return { ok: false, error: { kind: "invalid_title" } };
  }
  if (suggestedPrice !== undefined) {
    const price = parseFloat(suggestedPrice as string);
    if (isNaN(price) || price < 0) {
      return { ok: false, error: { kind: "invalid_price" } };
    }
  }
  if (genre !== undefined && (typeof genre !== "string" || genre.trim().length === 0)) {
    return { ok: false, error: { kind: "invalid_genre" } };
  }

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = (title as string).trim();
  if (suggestedPrice !== undefined) updates.suggestedPrice = suggestedPrice;
  if (genre !== undefined) updates.genre = (genre as string).trim();

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: { kind: "no_fields" } };
  }

  await deps.db.update(draftEbooks).set(updates).where(eq(draftEbooks.id, draftId));
  const [updated] = await deps.db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  return { ok: true, draft: updated };
}
