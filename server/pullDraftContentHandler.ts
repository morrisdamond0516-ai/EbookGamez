/**
 * pullDraftContentHandler.ts
 *
 * Extracted core logic for POST /api/admin/books/pull-draft-content so it can
 * be unit-tested independently of the full Express app setup.
 *
 * The handler:
 *  1. Authenticates with the live site via ADMIN_PASSWORD.
 *  2. Finds local draft_ebooks that are linked to a visible book but have no content.
 *  3. Matches those drafts against the live site's published drafts by title.
 *  4. Writes the live content into the local empty drafts.
 *  5. Runs a verification pass and returns counts + suspicious items.
 */

import { sql, eq } from "drizzle-orm";
import { draftEbooks } from "@shared/schema";

export interface PullDraftContentDeps {
  /** Drizzle DB instance (or compatible duck-type). */
  db: {
    execute: (query: any) => Promise<any>;
    update: (table: any) => {
      set: (values: any) => { where: (cond: any) => Promise<any> };
    };
  };
  /** fetch implementation — injected so tests can stub it. */
  fetch: typeof globalThis.fetch;
  /** Returns the ADMIN_PASSWORD value (or undefined when not set). */
  getAdminPassword: () => string | undefined;
}

export interface VerifyItem {
  draftId: number;
  title: string;
  wordCount: number;
  titleInContent: boolean;
}

export interface PullDraftContentResult {
  pulled: number;
  skipped: number;
  skippedTitles: string[];
  total: number;
  message: string;
  verification: {
    checked: number;
    suspicious: number;
    items: VerifyItem[];
  };
}

export type PullDraftContentError =
  | { kind: "missing_password" }
  | { kind: "auth_failed"; status: number }
  | { kind: "no_token" }
  | { kind: "live_drafts_failed"; status: number }
  | { kind: "unexpected"; error: unknown };

export type PullDraftContentOutcome =
  | { ok: true; result: PullDraftContentResult }
  | { ok: false; err: PullDraftContentError };

/**
 * Core implementation — call this from the Express route handler.
 *
 * @param rawLiveUrl  The live site base URL (trailing slash stripped internally).
 * @param deps        Injected dependencies; replace with stubs in tests.
 */
export async function pullDraftContent(
  rawLiveUrl: string,
  deps: PullDraftContentDeps,
): Promise<PullDraftContentOutcome> {
  const { db, fetch, getAdminPassword } = deps;
  const liveUrl = (rawLiveUrl || "https://EbookGamez.replit.app").replace(/\/$/, "");

  try {
    // ── 1. Find local empty drafts first (avoids a live-site round-trip when nothing to do) ──
    const emptyDraftsResult = await db.execute(sql`
      SELECT d.id AS draft_id, d.title
      FROM draft_ebooks d
      JOIN books b ON b.source_draft_id = d.id
      WHERE b.visible = true
        AND (d.content IS NULL OR d.content = '')
      ORDER BY d.id
    `);
    const rows = (emptyDraftsResult as any).rows as { draft_id: number; title: string }[];

    if (rows.length === 0) {
      return {
        ok: true,
        result: {
          pulled: 0,
          skipped: 0,
          skippedTitles: [],
          total: 0,
          message: "All linked drafts already have content — nothing to pull.",
          verification: { checked: 0, suspicious: 0, items: [] },
        },
      };
    }

    // ── 2. Authenticate with live site ────────────────────────────────────
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      return { ok: false, err: { kind: "missing_password" } };
    }

    const loginRes = await fetch(`${liveUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    if (!loginRes.ok) {
      return { ok: false, err: { kind: "auth_failed", status: loginRes.status } };
    }
    const loginData = (await loginRes.json()) as any;
    const liveToken: string = loginData.token;
    if (!liveToken) {
      return { ok: false, err: { kind: "no_token" } };
    }

    // ── 3. Fetch live published drafts ─────────────────────────────────────
    const liveDraftsRes = await fetch(
      `${liveUrl}/api/content-studio/drafts?status=published&limit=2000`,
      { headers: { "x-admin-token": liveToken } },
    );
    if (!liveDraftsRes.ok) {
      return { ok: false, err: { kind: "live_drafts_failed", status: liveDraftsRes.status } };
    }
    const liveDraftsData = (await liveDraftsRes.json()) as any;
    const liveDrafts: any[] = Array.isArray(liveDraftsData)
      ? liveDraftsData
      : (liveDraftsData.drafts ?? []);

    // Build title → live-draft map (case-insensitive, trimmed)
    const liveByTitle = new Map<string, any>();
    for (const ld of liveDrafts) {
      const key = (ld.title ?? "").toLowerCase().trim();
      if (key) liveByTitle.set(key, ld);
    }

    // ── 4. Pull content into each empty draft ──────────────────────────────
    let pulled = 0;
    let skipped = 0;
    const skippedTitles: string[] = [];

    for (const row of rows) {
      const key = (row.title ?? "").toLowerCase().trim();
      const liveDraft = liveByTitle.get(key);
      if (!liveDraft) {
        skipped++;
        skippedTitles.push(row.title);
        continue;
      }

      // Fetch the full draft when content was omitted from the list response
      let fullDraft = liveDraft;
      if (!fullDraft.content) {
        try {
          const detailRes = await fetch(
            `${liveUrl}/api/content-studio/drafts/${liveDraft.id}`,
            { headers: { "x-admin-token": liveToken } },
          );
          if (detailRes.ok) fullDraft = await detailRes.json();
        } catch {
          /* fall through — no content available */
        }
      }

      // Only count as pulled when we actually have content to write.
      // If neither the list entry nor the detail endpoint provided content,
      // the draft would remain blank — treat it as skipped rather than pulled.
      const resolvedContent: string | null = fullDraft.content ?? null;
      if (!resolvedContent) {
        skipped++;
        skippedTitles.push(row.title);
        continue;
      }

      const publishedAt = fullDraft.publishedAt ?? fullDraft.published_at ?? null;
      await db
        .update(draftEbooks)
        .set({
          content: resolvedContent,
          outline: fullDraft.outline ?? null,
          coverUrl: fullDraft.coverUrl ?? fullDraft.cover_url ?? null,
          backgroundUrl: fullDraft.backgroundUrl ?? fullDraft.background_url ?? null,
          pdfUrl: fullDraft.pdfUrl ?? fullDraft.pdf_url ?? null,
          description: fullDraft.description ?? null,
          status: "published",
          ...(publishedAt ? { publishedAt: new Date(publishedAt) } : {}),
        })
        .where(eq(draftEbooks.id, row.draft_id));

      pulled++;
    }

    const message =
      pulled === 0
        ? `No matches found on live site for ${rows.length} empty draft(s).`
        : `Pulled content for ${pulled} draft(s) from live site.${
            skipped > 0 ? ` ${skipped} skipped (no title match).` : ""
          }`;

    // ── 5. Verification pass ───────────────────────────────────────────────
    const verificationResult = await db.execute(sql`
      SELECT d.id AS draft_id, d.title, d.content, d.outline
      FROM draft_ebooks d
      JOIN books b ON b.source_draft_id = d.id
      WHERE b.visible = true
        AND d.content IS NOT NULL AND d.content <> ''
      ORDER BY d.id
    `);
    const verItems = (verificationResult as any).rows as {
      draft_id: number;
      title: string;
      content: string | null;
      outline: string | null;
    }[];

    const verification: (VerifyItem & { suspicious: boolean })[] = verItems.map((r) => {
      const titleLower = (r.title ?? "").toLowerCase().trim();
      const snippet = ((r.content ?? "") + " " + (r.outline ?? "")).slice(0, 2000).toLowerCase();
      const wordCount = (r.content ?? "").split(/\s+/).filter(Boolean).length;
      const titleWords = titleLower.split(/\s+/).filter((w) => w.length >= 4);
      const titleInContent =
        titleWords.length === 0 || titleWords.some((w) => snippet.includes(w));
      const suspicious = !titleInContent || wordCount < 100;
      return { draftId: r.draft_id, title: r.title, wordCount, titleInContent, suspicious };
    });

    const suspiciousItems = verification.filter((v) => v.suspicious);

    return {
      ok: true,
      result: {
        pulled,
        skipped,
        skippedTitles: skippedTitles.slice(0, 20),
        total: rows.length,
        message,
        verification: {
          checked: verification.length,
          suspicious: suspiciousItems.length,
          items: suspiciousItems.slice(0, 20).map(({ draftId, title, wordCount, titleInContent }) => ({
            draftId,
            title,
            wordCount,
            titleInContent,
          })),
        },
      },
    };
  } catch (error) {
    return { ok: false, err: { kind: "unexpected", error } };
  }
}
