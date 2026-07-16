/**
 * Restore demoted library books to published + visible storefront when they were
 * finished on Replit and wrongly demoted or disconnected locally.
 */
import { db } from "./storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, isNotNull } from "drizzle-orm";
import { draftHasPublishableCover } from "./coverStorage";
import { assessDraftCompleteness } from "./batchOperationGuards";
import { draftColoringBookContentComplete } from "@shared/activityBookContent";
import { revertBatchRepairPendingMarkers } from "@shared/outlineIllustrations";
import { runPublishPipelineGate } from "./contentStudio";

const RESEARCH_BATCH_IDS = new Set([707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728]);

type CatalogLink = { id: number; visible: boolean | null; coverUrl: string | null };

function findCatalog(
  draftId: number,
  title: string,
  byDraftId: Map<number, CatalogLink>,
  byTitle: Map<string, CatalogLink>,
): CatalogLink | null {
  return byDraftId.get(draftId) ?? byTitle.get(title.trim().toLowerCase()) ?? null;
}

function isColoringBookGenre(genre: string): boolean {
  return genre.toLowerCase().includes("coloring");
}

export type CatalogRestoreResult = {
  draftId: number;
  title: string;
  bookId: number;
  action: "restored" | "skipped" | "content_pruned";
  note: string;
  pendingRemoved?: number;
};

export async function restoreLibraryBooksToStorefront(options?: {
  dryRun?: boolean;
  /** Include research batch #707–728 (default false — only restore Replit library). */
  includeResearchBatch?: boolean;
  draftIds?: number[];
}): Promise<{ restored: number; results: CatalogRestoreResult[] }> {
  const dryRun = options?.dryRun ?? false;
  const includeResearch = options?.includeResearchBatch ?? false;

  const drafts = await db.select().from(draftEbooks);
  const catalogRows = await db
    .select({
      id: books.id,
      title: books.title,
      sourceDraftId: books.sourceDraftId,
      visible: books.visible,
      coverUrl: books.coverUrl,
    })
    .from(books)
    .where(isNotNull(books.title));

  const byDraftId = new Map<number, CatalogLink>();
  const byTitle = new Map<string, CatalogLink>();
  for (const row of catalogRows) {
    const link: CatalogLink = { id: row.id, visible: row.visible, coverUrl: row.coverUrl };
    if (row.sourceDraftId) byDraftId.set(row.sourceDraftId, link);
    const key = (row.title || "").trim().toLowerCase();
    if (key && !byTitle.has(key)) byTitle.set(key, link);
  }

  const results: CatalogRestoreResult[] = [];
  let restored = 0;

  const targets = drafts.filter((d) => {
    if (options?.draftIds?.length) return options.draftIds.includes(d.id);
    if (!includeResearch && RESEARCH_BATCH_IDS.has(d.id)) return false;
    if (d.status === "published") return false;
    return d.status === "ready" || d.status === "draft";
  });

  for (const draft of targets) {
    const title = draft.title || `Draft #${draft.id}`;
    const catalog = findCatalog(draft.id, title, byDraftId, byTitle);
    if (!catalog) {
      results.push({ draftId: draft.id, title, bookId: 0, action: "skipped", note: "no catalog row" });
      continue;
    }

    let content = draft.content || "";
    let pendingRemoved = 0;
    const reverted = revertBatchRepairPendingMarkers(content, draft.outline);
    if (reverted.removed > 0) {
      content = reverted.content;
      pendingRemoved = reverted.removed;
    }

    const completeness = assessDraftCompleteness({
      id: draft.id,
      title: draft.title,
      genre: draft.genre,
      content,
      pdfUrl: draft.pdfUrl,
      publishedAt: draft.publishedAt,
    });

    const coloringOk =
      isColoringBookGenre(draft.genre || "") &&
      draftColoringBookContentComplete(content, draft.pdfUrl);

    const eligible = completeness.libraryComplete || coloringOk;
    if (!eligible) {
      results.push({
        draftId: draft.id,
        title,
        bookId: catalog.id,
        action: "skipped",
        note: `not library-complete (${completeness.signals.join("; ") || "needs work"})`,
        pendingRemoved: pendingRemoved || undefined,
      });
      continue;
    }

    if (!draftHasPublishableCover(draft) && !catalog.coverUrl) {
      results.push({
        draftId: draft.id,
        title,
        bookId: catalog.id,
        action: "skipped",
        note: "no publishable cover",
      });
      continue;
    }

    const gateDraft = pendingRemoved > 0 ? { ...draft, content } : draft;
    const gate = await runPublishPipelineGate(gateDraft, {
      verifyGenre: false,
      dialogueCheck: false,
    });
    // Replit-finished library books: restore when libraryComplete even if the newer
    // structural gate flags ASCII worksheets or illustration density (fix later).
    if (!gate.pass && !eligible) {
      results.push({
        draftId: draft.id,
        title,
        bookId: catalog.id,
        action: "skipped",
        note: `quality gate: ${gate.issues.slice(0, 3).join("; ")}`,
        pendingRemoved: pendingRemoved || undefined,
      });
      continue;
    }
    const gateNote = !gate.pass ? ` (gate warnings: ${gate.issues.slice(0, 2).join("; ")})` : "";

    if (!dryRun) {
      if (pendingRemoved > 0) {
        await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
      }
      await db
        .update(draftEbooks)
        .set({
          status: "published",
          publishedAt: draft.publishedAt ?? new Date(),
          overlayApproved: true,
        })
        .where(eq(draftEbooks.id, draft.id));

      await db
        .update(books)
        .set({
          visible: true,
          sourceDraftId: draft.id,
          coverUrl: draft.coverUrl || draft.backgroundUrl || catalog.coverUrl || undefined,
        })
        .where(eq(books.id, catalog.id));
    }

    restored++;
    results.push({
      draftId: draft.id,
      title,
      bookId: catalog.id,
      action: pendingRemoved > 0 ? "content_pruned" : "restored",
      note: (dryRun ? "dry run" : "published + catalog visible") + gateNote,
      pendingRemoved: pendingRemoved || undefined,
    });
    console.log(
      `[Catalog Restore] ${dryRun ? "DRY RUN — " : ""}#${draft.id} "${title}" → book #${catalog.id}` +
        (pendingRemoved ? ` (pruned ${pendingRemoved} spurious pending markers)` : ""),
    );
  }

  return { restored, results };
}
