/**
 * tests/titleMismatches.test.ts
 *
 * Tests for the title/H1 mismatch detection feature.
 *
 * Coverage
 * --------
 * Unit tests — pure utility functions (server/titleMismatchUtils.ts)
 *   1.  Markdown H1 is extracted correctly.
 *   2.  HTML H1 is extracted correctly (with and without attributes).
 *   3.  No H1 present → extractFirstH1 returns null.
 *   4.  Only H2/H3 present → extractFirstH1 returns null (no false positive).
 *   5.  normalizeTitle collapses whitespace and lowercases.
 *   6.  isTitleMismatch returns false when titles match (case-insensitive).
 *   7.  isTitleMismatch returns true when titles differ.
 *   8.  isTitleMismatch treats extra whitespace as equal.
 *
 * Integration tests — getTitleMismatches() handler (server/titleMismatchHandler.ts)
 *   These exercise the real production handler with an injected db stub.
 *   9.  Draft with null content → excluded.
 *   10. Draft with matching markdown H1 → excluded.
 *   11. Draft with mismatched markdown H1 → appears in results.
 *   12. Draft with matching HTML H1 → excluded.
 *   13. Draft with mismatched HTML H1 → appears in results.
 *   14. Draft with no H1 heading at all → excluded.
 *   15. Case/whitespace differences → not a mismatch.
 *   16. Mixed batch: only the real mismatch is returned.
 *   17. Returns { mismatches, count } shape.
 *
 * Integration tests — patchDraft() handler (server/patchDraftHandler.ts)
 *   These exercise the real production handler with an injected db stub.
 *   18. Non-numeric id → invalid_id error.
 *   19. Draft not found → not_found error.
 *   20. Empty title string → invalid_title error.
 *   21. No fields provided → no_fields error.
 *   22. Valid title update → ok: true, returns updated draft.
 *   23. Valid suggestedPrice update → ok: true.
 *   24. Negative price → invalid_price error.
 *   25. Empty genre string → invalid_genre error.
 *
 * Express-layer smoke tests (supertest against a minimal real-handler app)
 *   26. GET /api/content-studio/title-mismatches — missing token → 401.
 *   27. GET /api/content-studio/title-mismatches — valid token, results returned.
 *   28. PATCH /api/content-studio/drafts/:id — missing token → 401.
 *   29. PATCH /api/content-studio/drafts/:id — not found → 404.
 *   30. PATCH /api/content-studio/drafts/:id — valid update → 200.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

import {
  extractFirstH1,
  normalizeTitle,
  isTitleMismatch,
  isAcceptableTitleH1Variance,
} from "../server/titleMismatchUtils";
import {
  getTitleMismatches,
  type TitleMismatchDeps,
} from "../server/titleMismatchHandler";
import { patchDraft, type PatchDraftDeps } from "../server/patchDraftHandler";

// ---------------------------------------------------------------------------
// 1-8  Pure utility unit tests
// ---------------------------------------------------------------------------

describe("extractFirstH1", () => {
  it("1. extracts a markdown # heading", () => {
    expect(extractFirstH1("# My Great Book\n\nParagraph.")).toBe("My Great Book");
  });

  it("2a. extracts a plain HTML <h1> tag", () => {
    expect(extractFirstH1("<h1>My Great Book</h1>\n<p>Body.</p>")).toBe("My Great Book");
  });

  it("2b. extracts an <h1> with attributes", () => {
    expect(extractFirstH1('<h1 class="main" id="top">My Great Book</h1>')).toBe(
      "My Great Book",
    );
  });

  it("2c. HTML h1 tag name match is case-insensitive", () => {
    expect(extractFirstH1("<H1>Upper Case Tag</H1>")).toBe("Upper Case Tag");
  });

  it("3. returns null when there is no heading at all", () => {
    expect(extractFirstH1("Just a paragraph.\n\nAnother paragraph.")).toBeNull();
  });

  it("4. does not treat ## or ### as an H1", () => {
    expect(extractFirstH1("## Chapter One\n\n### Sub-section\n\nParagraph.")).toBeNull();
  });

  it("strips trailing hashes in closed ATX headings", () => {
    expect(extractFirstH1("# Title #\n\nBody.")).toBe("Title");
  });

  it("returns null for empty string", () => {
    expect(extractFirstH1("")).toBeNull();
  });
});

describe("normalizeTitle", () => {
  it("5. lowercases and collapses multiple spaces", () => {
    expect(normalizeTitle("  Hello   World  ")).toBe("hello world");
  });

  it("treats tabs as whitespace", () => {
    expect(normalizeTitle("Hello\tWorld")).toBe("hello world");
  });
});

describe("isTitleMismatch", () => {
  it("6. returns false when titles match exactly", () => {
    expect(isTitleMismatch("My Book", "My Book")).toBe(false);
  });

  it("6b. returns false when only case differs", () => {
    expect(isTitleMismatch("My Book", "my book")).toBe(false);
  });

  it("7. returns true when titles are different", () => {
    expect(isTitleMismatch("My Book", "Their Book")).toBe(true);
  });

  it("8. returns false when only whitespace differs", () => {
    expect(isTitleMismatch("My   Book", "My Book")).toBe(false);
  });
});

describe("isAcceptableTitleH1Variance", () => {
  it("allows exact match", () => {
    expect(isAcceptableTitleH1Variance("Mastering Micro", "Mastering Micro")).toBe(true);
  });

  it("allows short H1 prefix of long stored title", () => {
    expect(
      isAcceptableTitleH1Variance(
        "Mastering Micro-Meditations: Using 2-Minute Practices to Reduce Stress",
        "Mastering Micro",
      ),
    ).toBe(true);
  });

  it("rejects completely different books", () => {
    expect(
      isAcceptableTitleH1Variance(
        "The Complete Home Electrical Wiring Guide",
        "Learning How to Learn: Science-Backed Strategies for Mastering Any Skill",
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helpers for DB stubs
// ---------------------------------------------------------------------------

/** Build a minimal db stub for getTitleMismatches.
 *  select().from().where() resolves to `rows`. */
function buildGetDb(
  rows: { id: number; title: string; content: string | null }[],
): TitleMismatchDeps["db"] {
  return {
    select: (_fields?: any) => ({
      from: (_table: any) => ({
        where: (_cond: any) => Promise.resolve(rows),
      }),
    }),
  };
}

/** Build a minimal db stub for patchDraft.
 *  `initial` is returned by the pre-check select; after update the spy
 *  merges updates and the post-update select returns the merged object. */
function buildPatchDb(initial: Record<string, any> | null): {
  db: PatchDraftDeps["db"];
  updateSpy: ReturnType<typeof vi.fn>;
} {
  let current = initial ? { ...initial } : null;
  const updateSpy = vi.fn().mockImplementation((_table: any) => ({
    set: (updates: Record<string, any>) => ({
      where: (_cond: any) => {
        if (current) current = { ...current, ...updates };
        return Promise.resolve(undefined);
      },
    }),
  }));

  const db: PatchDraftDeps["db"] = {
    select: () => ({
      from: (_table: any) => ({
        where: (_cond: any) => Promise.resolve(current ? [current] : []),
      }),
    }),
    update: updateSpy,
  };

  return { db, updateSpy };
}

// ---------------------------------------------------------------------------
// 9-17  getTitleMismatches() handler tests
// ---------------------------------------------------------------------------

describe("getTitleMismatches() — production handler", () => {
  it("9. excludes drafts with null content", async () => {
    const db = buildGetDb([{ id: 1, title: "A Book", content: null }]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(0);
    expect(result.mismatches).toHaveLength(0);
  });

  it("10. excludes draft when markdown H1 matches stored title", async () => {
    const db = buildGetDb([
      { id: 2, title: "How to Cook", content: "# How to Cook\n\nChapter 1..." },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(0);
  });

  it("11. includes draft when markdown H1 differs from stored title", async () => {
    const db = buildGetDb([
      { id: 3, title: "Old Title", content: "# New Title in Content\n\nBody." },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(1);
    expect(result.mismatches[0]).toEqual({
      id: 3,
      storedTitle: "Old Title",
      contentH1: "New Title in Content",
    });
  });

  it("12. excludes draft when HTML H1 matches stored title", async () => {
    const db = buildGetDb([
      { id: 4, title: "My Adventure", content: "<h1>My Adventure</h1><p>Text.</p>" },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(0);
  });

  it("13. includes draft when HTML H1 differs from stored title", async () => {
    const db = buildGetDb([
      {
        id: 5,
        title: "Stored Title",
        content: '<h1 class="hero">Different HTML Title</h1><p>Body.</p>',
      },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(1);
    expect(result.mismatches[0]).toMatchObject({
      id: 5,
      storedTitle: "Stored Title",
      contentH1: "Different HTML Title",
    });
  });

  it("14. excludes draft with content but no H1 heading", async () => {
    const db = buildGetDb([
      { id: 6, title: "Some Title", content: "Body text.\n\n## Chapter One\n\nNo H1." },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(0);
  });

  it("15. case and whitespace differences are not a mismatch", async () => {
    const db = buildGetDb([
      {
        id: 7,
        title: "  The Great   Journey  ",
        content: "# the great journey\n\nBody.",
      },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(0);
  });

  it("16. mixed batch: only the real mismatch is returned", async () => {
    const db = buildGetDb([
      { id: 10, title: "Matching Title", content: "# Matching Title\n\nBody." },
      { id: 11, title: "Right Name", content: "<h1>Wrong Name</h1><p>Body.</p>" },
      { id: 12, title: "No Heading", content: "Body text only, no H1." },
      { id: 13, title: "Empty", content: null },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result.count).toBe(1);
    expect(result.mismatches[0].id).toBe(11);
    expect(result.mismatches[0].storedTitle).toBe("Right Name");
    expect(result.mismatches[0].contentH1).toBe("Wrong Name");
  });

  it("17. returns the { mismatches, count } shape", async () => {
    const db = buildGetDb([
      { id: 20, title: "X", content: "# Y\n\nBody." },
    ]);
    const result = await getTitleMismatches({ db });
    expect(result).toHaveProperty("mismatches");
    expect(result).toHaveProperty("count");
    expect(typeof result.count).toBe("number");
    expect(Array.isArray(result.mismatches)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 18-25  patchDraft() handler tests
// ---------------------------------------------------------------------------

describe("patchDraft() — production handler", () => {
  it("18. returns invalid_id for a non-numeric id", async () => {
    const { db } = buildPatchDb(null);
    const outcome = await patchDraft("not-a-number", { title: "T" }, { db });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe("invalid_id");
  });

  it("19. returns not_found when draft does not exist", async () => {
    const { db } = buildPatchDb(null);
    const outcome = await patchDraft("999", { title: "T" }, { db });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe("not_found");
  });

  it("20. returns invalid_title for an empty title string", async () => {
    const { db } = buildPatchDb({ id: 1, title: "Original" });
    const outcome = await patchDraft("1", { title: "   " }, { db });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe("invalid_title");
  });

  it("21. returns no_fields when no updatable fields are sent", async () => {
    const { db } = buildPatchDb({ id: 1, title: "Original" });
    const outcome = await patchDraft("1", {}, { db });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe("no_fields");
  });

  it("22. returns ok and updated draft after a valid title update", async () => {
    const { db, updateSpy } = buildPatchDb({ id: 1, title: "Original Title" });
    const outcome = await patchDraft("1", { title: "Fixed Title" }, { db });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.draft.title).toBe("Fixed Title");
      expect(outcome.draft.id).toBe(1);
    }
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("23. returns ok when updating suggestedPrice with a valid value", async () => {
    const { db } = buildPatchDb({ id: 2, title: "A Book", suggestedPrice: "9.99" });
    const outcome = await patchDraft("2", { suggestedPrice: "14.99" }, { db });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.draft.suggestedPrice).toBe("14.99");
  });

  it("24. returns invalid_price when suggestedPrice is negative", async () => {
    const { db } = buildPatchDb({ id: 3, title: "A Book" });
    const outcome = await patchDraft("3", { suggestedPrice: "-5" }, { db });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe("invalid_price");
  });

  it("25. returns invalid_genre for an empty genre string", async () => {
    const { db } = buildPatchDb({ id: 4, title: "A Book" });
    const outcome = await patchDraft("4", { genre: "  " }, { db });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe("invalid_genre");
  });
});

// ---------------------------------------------------------------------------
// 26-30  Express-layer smoke tests
//
// A thin Express app that wires the real handlers (getTitleMismatches,
// patchDraft) with auth middleware, matching the production route structure
// in routes.ts. This confirms the HTTP contract is intact.
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = "smoke-test-admin-token";

function buildSmokeApp(
  getMismatchDb: TitleMismatchDeps["db"],
  patchDbFactory: (id: number) => ReturnType<typeof buildPatchDb>,
) {
  const app = express();
  app.use(express.json());

  function isAdmin(req: any) {
    return req.headers["x-admin-token"] === ADMIN_TOKEN;
  }

  // Matches the production route: GET /api/content-studio/title-mismatches
  app.get("/api/content-studio/title-mismatches", async (req: any, res: any) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await getTitleMismatches({ db: getMismatchDb });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Matches the production route: PATCH /api/content-studio/drafts/:id
  app.patch("/api/content-studio/drafts/:id", async (req: any, res: any) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { db } = patchDbFactory(parseInt(req.params.id, 10));
      const outcome = await patchDraft(req.params.id, req.body, { db });
      if (!outcome.ok) {
        const { kind } = outcome.error;
        if (kind === "invalid_id") return res.status(400).json({ error: "Invalid draft ID" });
        if (kind === "not_found")  return res.status(404).json({ error: "Draft not found" });
        if (kind === "invalid_title") return res.status(400).json({ error: "Title must be a non-empty string" });
        if (kind === "invalid_price") return res.status(400).json({ error: "Price must be a valid positive number" });
        if (kind === "invalid_genre") return res.status(400).json({ error: "Genre must be a non-empty string" });
        if (kind === "no_fields")  return res.status(400).json({ error: "No valid fields to update" });
      }
      if (outcome.ok) return res.json(outcome.draft);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

describe("Express smoke tests — real handlers, real HTTP contracts", () => {
  it("26. GET /api/content-studio/title-mismatches — no token → 401", async () => {
    const app = buildSmokeApp(buildGetDb([]), () => buildPatchDb(null));
    const res = await request(app).get("/api/content-studio/title-mismatches");
    expect(res.status).toBe(401);
  });

  it("27. GET /api/content-studio/title-mismatches — valid token, mismatch returned", async () => {
    const db = buildGetDb([
      { id: 99, title: "Stored", content: "# Different\n\nBody." },
    ]);
    const app = buildSmokeApp(db, () => buildPatchDb(null));
    const res = await request(app)
      .get("/api/content-studio/title-mismatches")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.mismatches[0].id).toBe(99);
  });

  it("28. PATCH /api/content-studio/drafts/:id — no token → 401", async () => {
    const app = buildSmokeApp(buildGetDb([]), () => buildPatchDb({ id: 1, title: "T" }));
    const res = await request(app)
      .patch("/api/content-studio/drafts/1")
      .send({ title: "New" });
    expect(res.status).toBe(401);
  });

  it("29. PATCH /api/content-studio/drafts/:id — draft not found → 404", async () => {
    const app = buildSmokeApp(buildGetDb([]), () => buildPatchDb(null));
    const res = await request(app)
      .patch("/api/content-studio/drafts/999")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ title: "New" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("30. PATCH /api/content-studio/drafts/:id — valid title update → 200", async () => {
    const app = buildSmokeApp(
      buildGetDb([]),
      () => buildPatchDb({ id: 5, title: "Original" }),
    );
    const res = await request(app)
      .patch("/api/content-studio/drafts/5")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ title: "Fixed Title" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Fixed Title");
  });
});
