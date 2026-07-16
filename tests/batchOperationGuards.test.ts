import { describe, expect, it } from "vitest";
import {
  assessDraftCompleteness,
  assertBatchMutationAllowed,
  BatchOperationGuardError,
  preflightActivityLineRepair,
} from "../server/batchOperationGuards";

describe("batchOperationGuards", () => {
  it("treats coloring book with PDF and page markers as library-complete", () => {
    const content = "**Page 1:**\n\nLine art here.\n\n**Page 2:**\n\nMore art.";
    const a = assessDraftCompleteness({
      id: 385,
      title: "Kawaii Coloring",
      genre: "Coloring Books",
      content,
      pdfUrl: "/uploads/pdfs/kawaii.pdf",
    });
    expect(a.libraryComplete).toBe(true);
    expect(a.illustrationQueueNeeded).toBe(false);
  });

  it("skips library-complete activity books in batch repair preflight", () => {
    const ch = "## Chapter 1\n\nIntro.\n\n";
    const resolved = "[ILLUSTRATION: /uploads/illustrations/a.png | scene]\n";
    const content = ch + resolved.repeat(12);
    const preflight = preflightActivityLineRepair([
      {
        id: 661,
        title: "Anxiety Workbook",
        genre: "Workbooks",
        content,
        pdfUrl: "/uploads/pdfs/w.pdf",
      },
    ]);
    expect(preflight.wouldModify).toHaveLength(0);
    expect(preflight.wouldSkip.length).toBeGreaterThan(0);
  });

  it("blocks batch mutation without confirmation when multiple targets", () => {
    const preflight = preflightActivityLineRepair([
      { id: 1, title: "A", genre: "Activity Books", content: "|---|\n| . |\n|---|---|" },
      { id: 2, title: "B", genre: "Workbooks", content: "|---|\n| x |\n|---|---|" },
    ]);
    expect(preflight.requiresConfirmation).toBe(true);
    expect(() => assertBatchMutationAllowed(preflight)).toThrow(BatchOperationGuardError);
    expect(() =>
      assertBatchMutationAllowed(preflight, { confirmedAfterPreflight: true }),
    ).not.toThrow();
  });
});
