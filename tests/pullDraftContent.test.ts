/**
 * tests/pullDraftContent.test.ts
 *
 * Unit tests for the Pull Content feature (POST /api/admin/books/pull-draft-content).
 *
 * Strategy
 * --------
 * The core logic lives in server/pullDraftContentHandler.ts, which accepts
 * injected dependencies (db, fetch, getAdminPassword). Each test supplies stubs
 * so no real database or HTTP calls are made.
 *
 * Covered scenarios
 * -----------------
 *  1. Happy path — N empty drafts matched by title, content pulled, correct counts returned.
 *  2. No empty drafts — all linked drafts already have content; returns pulled=0, skipped=0.
 *  3. Partial match — some drafts matched, others skipped (no title match on live site).
 *  4. ADMIN_PASSWORD missing — returns missing_password error immediately.
 *  5. Live site auth failure — returns auth_failed error.
 *  6. Detail fetch falls back to list data when the per-draft endpoint fails.
 *
 * Express-layer smoke tests (via supertest)
 * -----------------------------------------
 *  7. Missing admin token → 401.
 *  8. Valid token, all drafts filled → 200 with pulled=0 message.
 *  9. Valid token, two empty drafts → 200 with pulled=2 and toast-compatible message.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { pullDraftContent, type PullDraftContentDeps } from "../server/pullDraftContentHandler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake Response (enough for pullDraftContent to consume). */
function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A fetch stub that returns predefined responses keyed by URL substring. */
function buildFetch(
  routes: Record<string, { body: unknown; status?: number }>,
): typeof globalThis.fetch {
  return async (input: any, _init?: any) => {
    const url = typeof input === "string" ? input : String(input);
    for (const [key, val] of Object.entries(routes)) {
      if (url.includes(key)) {
        return fakeResponse(val.body, val.status ?? 200);
      }
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

/** Minimal DB stub. dbUpdate is a spy so tests can assert it was called. */
function buildDb(
  emptyDraftRows: { draft_id: number; title: string }[],
  verificationRows: { draft_id: number; title: string; content: string | null; outline: string | null }[] = [],
) {
  const updateSpy = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  // db.execute is called twice: once for empty drafts, once for verification.
  const executeSpy = vi
    .fn()
    .mockResolvedValueOnce({ rows: emptyDraftRows })
    .mockResolvedValueOnce({ rows: verificationRows });

  return {
    db: { execute: executeSpy, update: updateSpy },
    updateSpy,
    executeSpy,
  };
}

// ---------------------------------------------------------------------------
// Core handler tests (no Express layer)
// ---------------------------------------------------------------------------

describe("pullDraftContent() — core handler", () => {
  // ── 1. Happy path ────────────────────────────────────────────────────────

  it("pulls content for every empty draft that matches by title on the live site", async () => {
    const { db, updateSpy } = buildDb(
      [
        { draft_id: 10, title: "How to Draw Manga" },
        { draft_id: 11, title: "Python for Beginners" },
      ],
      // verification rows after pulling
      [
        { draft_id: 10, title: "How to Draw Manga", content: "How to Draw Manga chapter one text...".repeat(20), outline: null },
        { draft_id: 11, title: "Python for Beginners", content: "Python for Beginners intro chapter".repeat(20), outline: null },
      ],
    );

    const deps: PullDraftContentDeps = {
      db: db as any,
      fetch: buildFetch({
        "/api/admin/login": { body: { token: "live-token-abc" } },
        "/api/content-studio/drafts?status=published": {
          body: [
            { id: 201, title: "How to Draw Manga", content: "How to Draw Manga chapter one text...".repeat(20) },
            { id: 202, title: "Python for Beginners", content: "Python for Beginners intro chapter".repeat(20) },
          ],
        },
      }),
      getAdminPassword: () => "secret123",
    };

    const outcome = await pullDraftContent("https://ebookgamez.replit.app", deps);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return; // narrow type

    expect(outcome.result.pulled).toBe(2);
    expect(outcome.result.skipped).toBe(0);
    expect(outcome.result.total).toBe(2);
    expect(outcome.result.message).toContain("Pulled content for 2 draft(s)");
    // db.update must have been called once per matched draft
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  // ── 2. No empty drafts ───────────────────────────────────────────────────

  it("returns pulled=0 and a 'nothing to pull' message when all drafts already have content", async () => {
    // db.execute returns no rows on the first call (empty-drafts query)
    const executeSpy = vi.fn().mockResolvedValueOnce({ rows: [] });
    const deps: PullDraftContentDeps = {
      db: { execute: executeSpy, update: vi.fn() } as any,
      fetch: vi.fn() as any, // fetch must NOT be called
      getAdminPassword: () => "secret123",
    };

    const outcome = await pullDraftContent("https://ebookgamez.replit.app", deps);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.pulled).toBe(0);
    expect(outcome.result.skipped).toBe(0);
    expect(outcome.result.total).toBe(0);
    expect(outcome.result.message).toMatch(/nothing to pull/i);

    // fetch is only called after we know there are empty drafts; none here
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  // ── 3. Partial match — some drafts skipped ───────────────────────────────

  it("skips drafts that have no title match on the live site and reports the counts", async () => {
    const { db, updateSpy } = buildDb(
      [
        { draft_id: 20, title: "Matched Book" },
        { draft_id: 21, title: "Unmatched Book" },
      ],
      [{ draft_id: 20, title: "Matched Book", content: "Matched Book content here ".repeat(20), outline: null }],
    );

    const deps: PullDraftContentDeps = {
      db: db as any,
      fetch: buildFetch({
        "/api/admin/login": { body: { token: "tok" } },
        "/api/content-studio/drafts?status=published": {
          body: [
            // Only one of the two titles is present on the live site
            { id: 301, title: "Matched Book", content: "Matched Book content here ".repeat(20) },
          ],
        },
      }),
      getAdminPassword: () => "pw",
    };

    const outcome = await pullDraftContent("https://ebookgamez.replit.app", deps);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.pulled).toBe(1);
    expect(outcome.result.skipped).toBe(1);
    expect(outcome.result.skippedTitles).toContain("Unmatched Book");
    expect(outcome.result.message).toContain("1 skipped");
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  // ── 4. Missing ADMIN_PASSWORD ────────────────────────────────────────────

  it("returns missing_password error when ADMIN_PASSWORD is not set", async () => {
    // DB must return at least one empty draft so the handler proceeds past the
    // early-exit check and reaches the auth step where it detects the missing password.
    const executeSpy = vi.fn().mockResolvedValueOnce({ rows: [{ draft_id: 99, title: "Some Draft" }] });
    const deps: PullDraftContentDeps = {
      db: { execute: executeSpy, update: vi.fn() } as any,
      fetch: vi.fn() as any,
      getAdminPassword: () => undefined,
    };

    const outcome = await pullDraftContent("https://ebookgamez.replit.app", deps);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.err.kind).toBe("missing_password");
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  // ── 5. Live site auth failure ────────────────────────────────────────────

  it("returns auth_failed error when the live site login endpoint rejects", async () => {
    const executeSpy = vi.fn().mockResolvedValueOnce({ rows: [{ draft_id: 99, title: "Some Draft" }] });
    const deps: PullDraftContentDeps = {
      db: { execute: executeSpy, update: vi.fn() } as any,
      fetch: buildFetch({
        "/api/admin/login": { body: { error: "wrong password" }, status: 401 },
      }),
      getAdminPassword: () => "wrong",
    };

    const outcome = await pullDraftContent("https://ebookgamez.replit.app", deps);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.err.kind).toBe("auth_failed");
    if (outcome.err.kind === "auth_failed") {
      expect(outcome.err.status).toBe(401);
    }
  });

  // ── 6. Detail fallback — draft skipped when no content can be retrieved ──

  it("counts a draft as skipped (not pulled) when list entry has no content and detail fetch fails", async () => {
    // The list entry has NO content so the handler tries the detail endpoint.
    // The detail endpoint throws a network error; since we end up with no
    // content to write the draft must be counted as skipped, not pulled.
    const { db, updateSpy } = buildDb(
      [{ draft_id: 30, title: "Fragile Book" }],
      [], // verification rows — nothing pulled
    );

    const fetchStub: typeof globalThis.fetch = async (input: any, _init?: any) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("/api/admin/login")) return fakeResponse({ token: "tok" });
      if (url.includes("/api/content-studio/drafts?status=published")) {
        return fakeResponse([
          { id: 400, title: "Fragile Book" /* no content field */ },
        ]);
      }
      if (url.includes("/api/content-studio/drafts/400")) {
        throw new Error("Network timeout");
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const deps: PullDraftContentDeps = {
      db: db as any,
      fetch: fetchStub,
      getAdminPassword: () => "pw",
    };

    const outcome = await pullDraftContent("https://ebookgamez.replit.app", deps);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // No content was available → draft must NOT be counted as pulled
    expect(outcome.result.pulled).toBe(0);
    expect(outcome.result.skipped).toBe(1);
    expect(outcome.result.skippedTitles).toContain("Fragile Book");
    // db.update must NOT have been called — blank drafts are never persisted
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Express-layer smoke tests (the route wired into a real Express app)
// ---------------------------------------------------------------------------

/**
 * Build a minimal Express app with the pull-draft-content route using
 * the extracted handler, so we can test auth gating and HTTP response shape.
 */
function buildApp(opts: {
  adminToken: string;
  emptyDraftRows: { draft_id: number; title: string }[];
  liveDrafts: any[];
  verificationRows?: any[];
}) {
  const { adminToken, emptyDraftRows, liveDrafts, verificationRows = [] } = opts;

  const executeSpy = vi
    .fn()
    .mockResolvedValueOnce({ rows: emptyDraftRows })
    .mockResolvedValueOnce({ rows: verificationRows });

  const mockDb = {
    execute: executeSpy,
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
  };

  const mockFetch = buildFetch({
    "/api/admin/login": { body: { token: "live-tok" } },
    "/api/content-studio/drafts?status=published": { body: liveDrafts },
  });

  const app = express();
  app.use(express.json());

  // Minimal admin-auth gate identical to what routes.ts does
  const adminSessions = new Set<string>([adminToken]);
  function isAdmin(req: express.Request): boolean {
    const tok = req.headers["x-admin-token"] as string;
    return !!tok && adminSessions.has(tok);
  }

  app.post("/api/admin/books/pull-draft-content", async (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin authentication required" });

    const { liveUrl: rawLiveUrl } = req.body as { liveUrl?: string };
    const { pullDraftContent: handler } = await import("../server/pullDraftContentHandler");

    const outcome = await handler(rawLiveUrl ?? "https://EbookGamez.replit.app", {
      db: mockDb as any,
      fetch: mockFetch,
      getAdminPassword: () => "secret",
    });

    if (!outcome.ok) {
      const { kind } = outcome.err;
      if (kind === "missing_password") return res.status(500).json({ error: "ADMIN_PASSWORD not set" });
      if (kind === "auth_failed") return res.status(502).json({ error: "Live site auth failed" });
      if (kind === "no_token") return res.status(502).json({ error: "No token from live site" });
      if (kind === "live_drafts_failed") return res.status(502).json({ error: "Live drafts fetch failed" });
      return res.status(500).json({ error: "Unexpected error" });
    }

    return res.json(outcome.result);
  });

  return app;
}

describe("POST /api/admin/books/pull-draft-content — HTTP layer", () => {
  const VALID_TOKEN = "test-admin-token-abc";

  // ── 7. Missing admin token ────────────────────────────────────────────────

  it("returns 401 when the x-admin-token header is missing", async () => {
    const app = buildApp({ adminToken: VALID_TOKEN, emptyDraftRows: [], liveDrafts: [] });
    const res = await request(app).post("/api/admin/books/pull-draft-content").send({});
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringContaining("Admin authentication") });
  });

  // ── 8. No empty drafts → 200 with pulled=0 message ───────────────────────

  it("returns HTTP 200 with pulled=0 when all drafts already have content", async () => {
    const app = buildApp({ adminToken: VALID_TOKEN, emptyDraftRows: [], liveDrafts: [] });

    const res = await request(app)
      .post("/api/admin/books/pull-draft-content")
      .set("x-admin-token", VALID_TOKEN)
      .send({ liveUrl: "https://ebookgamez.replit.app" });

    expect(res.status).toBe(200);
    expect(res.body.pulled).toBe(0);
    expect(res.body.skipped).toBe(0);
    expect(res.body.message).toMatch(/nothing to pull/i);
  });

  // ── 9. Two empty drafts matched → 200 with pulled=2 ──────────────────────

  it("returns HTTP 200 with pulled=2 when two empty drafts are matched and filled", async () => {
    const longContent = (title: string) => `${title} ${"word ".repeat(120)}`;

    const app = buildApp({
      adminToken: VALID_TOKEN,
      emptyDraftRows: [
        { draft_id: 50, title: "First Empty Book" },
        { draft_id: 51, title: "Second Empty Book" },
      ],
      liveDrafts: [
        { id: 501, title: "First Empty Book", content: longContent("First Empty Book") },
        { id: 502, title: "Second Empty Book", content: longContent("Second Empty Book") },
      ],
      verificationRows: [
        { draft_id: 50, title: "First Empty Book", content: longContent("First Empty Book"), outline: null },
        { draft_id: 51, title: "Second Empty Book", content: longContent("Second Empty Book"), outline: null },
      ],
    });

    const res = await request(app)
      .post("/api/admin/books/pull-draft-content")
      .set("x-admin-token", VALID_TOKEN)
      .send({ liveUrl: "https://ebookgamez.replit.app" });

    expect(res.status).toBe(200);
    expect(res.body.pulled).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(res.body.total).toBe(2);
    expect(res.body.message).toContain("Pulled content for 2 draft(s)");
    // Verification block is present
    expect(res.body.verification).toBeDefined();
    expect(res.body.verification.checked).toBe(2);
  });

  // ── 10. Skipped drafts appear in the response ─────────────────────────────

  it("returns the skipped count when one draft has no title match on the live site", async () => {
    const app = buildApp({
      adminToken: VALID_TOKEN,
      emptyDraftRows: [
        { draft_id: 60, title: "Present On Live" },
        { draft_id: 61, title: "Missing From Live" },
      ],
      liveDrafts: [
        { id: 601, title: "Present On Live", content: "Present On Live content ".repeat(40) },
        // "Missing From Live" is intentionally absent
      ],
      verificationRows: [
        { draft_id: 60, title: "Present On Live", content: "Present On Live content ".repeat(40), outline: null },
      ],
    });

    const res = await request(app)
      .post("/api/admin/books/pull-draft-content")
      .set("x-admin-token", VALID_TOKEN)
      .send({ liveUrl: "https://ebookgamez.replit.app" });

    expect(res.status).toBe(200);
    expect(res.body.pulled).toBe(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.skippedTitles).toContain("Missing From Live");
    expect(res.body.message).toContain("1 skipped");
  });
});
