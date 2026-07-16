/**
 * Preflight guards for batch / destructive Content Studio operations.
 * Prevents modifying Replit-finished library books without an explicit confirm flag.
 */
import {
  activityBookNeedsStructureRepair,
  countAsciiPuzzleLines,
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
  draftColoringBookContentComplete,
  draftNeedsIllustrationQueueEntry,
  isActivityOrWorkbookGenre,
  isPlannerGenre,
} from "@shared/activityBookContent";

export class BatchOperationGuardError extends Error {
  readonly code = "BATCH_GUARD_BLOCKED";
  readonly preflight: BatchPreflightReport;

  constructor(message: string, preflight: BatchPreflightReport) {
    super(message);
    this.name = "BatchOperationGuardError";
    this.preflight = preflight;
  }
}

export type DraftGuardInput = {
  id: number;
  title?: string | null;
  genre?: string | null;
  content?: string | null;
  pdfUrl?: string | null;
  publishedAt?: Date | string | null;
};

export type DraftCompletenessAssessment = {
  draftId: number;
  title: string;
  libraryComplete: boolean;
  signals: string[];
  illustrationQueueNeeded: boolean;
  illustrationQueueReason: string;
  needsStructureRepair: boolean;
  asciiLines: number;
  pendingMarkers: number;
  resolvedMarkers: number;
};

export type BatchPreflightReport = {
  operation: string;
  wouldModify: DraftCompletenessAssessment[];
  wouldSkip: Array<{ draftId: number; title: string; reason: string }>;
  requiresConfirmation: boolean;
  summary: string;
};

function isColoringBookGenre(genre: string): boolean {
  return genre.toLowerCase().includes("coloring");
}

/** Read-only: is this draft already customer-ready (Replit pipeline finished)? */
export function assessDraftCompleteness(draft: DraftGuardInput): DraftCompletenessAssessment {
  const title = draft.title || `Draft #${draft.id}`;
  const genre = draft.genre || "";
  const content = draft.content || "";
  const signals: string[] = [];

  const asciiLines = countAsciiPuzzleLines(content);
  const pendingMarkers = countUnprocessedIllustrationMarkers(content);
  const resolvedMarkers = countResolvedIllustrationMarkers(content);
  const needsStructureRepair = isActivityOrWorkbookGenre(genre)
    ? activityBookNeedsStructureRepair(content, genre)
    : false;

  const queue = draftNeedsIllustrationQueueEntry(content, genre);

  if (isColoringBookGenre(genre) && draftColoringBookContentComplete(content, draft.pdfUrl)) {
    signals.push("coloring book has page markers and/or PDF");
  }
  if (resolvedMarkers >= 10) {
    signals.push(`${resolvedMarkers} resolved illustration image(s) in content`);
  }
  if (draft.pdfUrl?.trim()) {
    signals.push("PDF generated");
  }
  if (isPlannerGenre(genre) && draft.pdfUrl?.trim()) {
    signals.push("planner PDF — text-only interior");
  }
  if (draft.publishedAt) {
    signals.push("was published (published_at set)");
  }
  if (!queue.needs && pendingMarkers > 0 && resolvedMarkers > 0) {
    signals.push("illustration queue logic: existing art satisfies publish bar");
  }

  const libraryComplete =
    (isColoringBookGenre(genre) && draftColoringBookContentComplete(content, draft.pdfUrl)) ||
    (isPlannerGenre(genre) && !!draft.pdfUrl?.trim()) ||
    (!queue.needs && resolvedMarkers > 0 && asciiLines === 0) ||
    (resolvedMarkers >= 20 && !queue.needs);

  return {
    draftId: draft.id,
    title,
    libraryComplete,
    signals,
    illustrationQueueNeeded: queue.needs,
    illustrationQueueReason: queue.reason,
    needsStructureRepair,
    asciiLines,
    pendingMarkers,
    resolvedMarkers,
  };
}

export function preflightActivityLineRepair(drafts: DraftGuardInput[]): BatchPreflightReport {
  const wouldModify: DraftCompletenessAssessment[] = [];
  const wouldSkip: Array<{ draftId: number; title: string; reason: string }> = [];

  for (const draft of drafts) {
    const assessment = assessDraftCompleteness(draft);
    if (!isActivityOrWorkbookGenre(draft.genre) || !draft.content?.trim()) continue;

    if (assessment.libraryComplete) {
      wouldSkip.push({
        draftId: draft.id,
        title: assessment.title,
        reason: `Library-complete (${assessment.signals.join("; ")}) — batch repair blocked`,
      });
      continue;
    }

    if (!assessment.needsStructureRepair) continue;

    wouldModify.push(assessment);
  }

  const libraryCompleteInModify = wouldModify.filter((d) => d.libraryComplete);
  const requiresConfirmation =
    wouldModify.length > 1 || libraryCompleteInModify.length > 0 || wouldModify.some((d) => d.resolvedMarkers >= 10);

  const summary = [
    `${wouldModify.length} draft(s) would be modified`,
    `${wouldSkip.length} library-complete draft(s) would be skipped`,
    requiresConfirmation ? "CONFIRMATION REQUIRED before running" : "safe to run on listed targets only",
  ].join("; ");

  return {
    operation: "activity-line-repair",
    wouldModify,
    wouldSkip,
    requiresConfirmation,
    summary,
  };
}

export function assertBatchMutationAllowed(
  preflight: BatchPreflightReport,
  options?: { confirmedAfterPreflight?: boolean; dryRun?: boolean },
): void {
  if (options?.dryRun) return;

  if (preflight.wouldModify.length === 0) {
    throw new BatchOperationGuardError(
      `No drafts qualify for ${preflight.operation} after preflight.`,
      preflight,
    );
  }

  if (preflight.requiresConfirmation && !options?.confirmedAfterPreflight) {
    throw new BatchOperationGuardError(
      `Preflight required: ${preflight.summary}. Run dry-run/preflight first, then pass confirmedAfterPreflight: true.`,
      preflight,
    );
  }
}

/** Demotion/re-audit only when illustration queue agrees there is real unfinished work. */
export function draftNeedsIllustrationDemotion(
  content: string,
  genre: string | null | undefined,
): { demote: boolean; reason: string } {
  const assessment = assessDraftCompleteness({
    id: 0,
    genre,
    content,
  });
  if (assessment.libraryComplete) {
    return { demote: false, reason: "library-complete" };
  }
  if (!assessment.illustrationQueueNeeded) {
    return { demote: false, reason: "illustration queue: no action needed" };
  }
  return { demote: true, reason: assessment.illustrationQueueReason };
}
