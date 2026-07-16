/**
 * Recover existing cover URLs from production, catalog, and peer drafts.
 * Marks satisfied covers for deferred regen (no new AI cover spend).
 */
import { db } from "./storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, inArray, isNotNull } from "drizzle-orm";
import {
  coverFileExistsLocally,
  coverFilenameFromUrl,
} from "./coverStorage";
import {
  type CoverRecoverySource,
  withCoverDeferredInDescription,
  parseCoverDeferredFromDescription,
  stripCoverDeferredFromDescription,
} from "@shared/coverMetadata";
import { fetchCoverFromProduction } from "./coverProxy";
import { LOST_COVER_REGEN_IDS } from "@shared/coverConstants";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || process.env.COVER_SYNC_BASE_URL || "https://ebookgamez.com";

type CatalogLink = { id: number; visible: boolean | null; coverUrl: string | null };

function findCatalogLinkInMemory(
  draftId: number,
  title: string,
  byDraftId: Map<number, CatalogLink>,
  byTitle: Map<string, CatalogLink>,
): CatalogLink | null {
  const byId = byDraftId.get(draftId);
  if (byId) return byId;
  return byTitle.get(title.trim().toLowerCase()) ?? null;
}

export type CoverRecoveryResult = {
  draftId: number;
  title: string;
  action: "recovered" | "deferred" | "skipped" | "failed";
  coverUrl: string | null;
  source?: CoverRecoverySource;
  note?: string;
};

async function coverExistsOnProduction(url: string): Promise<boolean> {
  if (!url?.trim()) return false;
  try {
    const res = await fetch(`${PRODUCTION_BASE}${url}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function downloadCoverIfMissing(url: string | null): Promise<boolean> {
  if (!url) return false;
  const fn = coverFilenameFromUrl(url);
  if (!fn) return false;
  if (coverFileExistsLocally(url)) return true;
  const buf = await fetchCoverFromProduction(fn, true);
  return !!buf;
}

async function loginProductionAdmin(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  try {
    const res = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return null;
    return (await res.json()).token;
  } catch {
    return null;
  }
}

async function fetchProductionDraftCovers(
  token: string,
): Promise<Map<number, { coverUrl?: string; backgroundUrl?: string; title: string }>> {
  const map = new Map<number, { coverUrl?: string; backgroundUrl?: string; title: string }>();
  for (const status of ["published", "ready"]) {
    const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts?status=${status}`, {
      headers: { "x-admin-token": token },
    });
    if (!res.ok) continue;
    const rows: { id: number; title: string; coverUrl?: string; backgroundUrl?: string }[] =
      await res.json();
    for (const row of rows) {
      map.set(row.id, row);
    }
  }
  return map;
}

export async function recoverExistingCovers(options?: {
  draftIds?: number[];
  statuses?: string[];
  dryRun?: boolean;
}): Promise<CoverRecoveryResult[]> {
  const statuses = options?.statuses ?? ["ready", "published"];
  const dryRun = options?.dryRun ?? false;

  const draftQuery = db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      status: draftEbooks.status,
      description: draftEbooks.description,
      coverUrl: draftEbooks.coverUrl,
      backgroundUrl: draftEbooks.backgroundUrl,
      publishedAt: draftEbooks.publishedAt,
    })
    .from(draftEbooks);

  const allDrafts = options?.draftIds?.length
    ? await draftQuery.where(inArray(draftEbooks.id, options.draftIds))
    : await draftQuery.where(inArray(draftEbooks.status, statuses));

  const catalogByDraftId = new Map<number, string>();
  const catalogByTitle = new Map<string, string>();
  const catalogRowByDraftId = new Map<number, CatalogLink>();
  const catalogRowByTitle = new Map<string, CatalogLink>();
  const catalogRows = await db
    .select({
      id: books.id,
      sourceDraftId: books.sourceDraftId,
      title: books.title,
      coverUrl: books.coverUrl,
      visible: books.visible,
    })
    .from(books)
    .where(isNotNull(books.coverUrl));

  for (const row of catalogRows) {
    if (row.sourceDraftId) {
      if (row.coverUrl) catalogByDraftId.set(row.sourceDraftId, row.coverUrl);
      catalogRowByDraftId.set(row.sourceDraftId, { id: row.id, visible: row.visible, coverUrl: row.coverUrl });
    }
    if (row.title) {
      const key = row.title.trim().toLowerCase();
      if (row.coverUrl) catalogByTitle.set(key, row.coverUrl);
      if (!catalogRowByTitle.has(key)) {
        catalogRowByTitle.set(key, { id: row.id, visible: row.visible, coverUrl: row.coverUrl });
      }
    }
  }

  const token = await loginProductionAdmin();
  const prodById = token ? await fetchProductionDraftCovers(token) : new Map();

  const results: CoverRecoveryResult[] = [];

  for (const draft of allDrafts) {
    const title = draft.title || `Draft #${draft.id}`;
    let coverUrl = draft.coverUrl;
    let backgroundUrl = draft.backgroundUrl;
    let source: CoverRecoverySource | undefined;
    let note: string | undefined;

    const alreadyLocal =
      coverFileExistsLocally(coverUrl) || coverFileExistsLocally(backgroundUrl);
    const existingDeferred = parseCoverDeferredFromDescription(draft.description);

    if (alreadyLocal && coverUrl) {
      const catalog = findCatalogLinkInMemory(draft.id, title, catalogRowByDraftId, catalogRowByTitle);
      const restorePublished = catalog != null && draft.status === "ready";
      const needsDeferred = !existingDeferred && LOST_COVER_REGEN_IDS.has(draft.id);

      if (!dryRun && (restorePublished || needsDeferred)) {
        const description = needsDeferred
          ? withCoverDeferredInDescription(stripCoverDeferredFromDescription(draft.description), {
              source: "local",
              coverUrl,
              backgroundUrl: backgroundUrl || coverUrl,
              recoveredAt: new Date().toISOString(),
              deferRegen: true,
              note: "Local file present — regen deferred",
            })
          : draft.description;

        await db
          .update(draftEbooks)
          .set({
            ...(needsDeferred ? { description } : {}),
            overlayApproved: true,
            ...(restorePublished
              ? { status: "published", publishedAt: draft.publishedAt ?? new Date() }
              : {}),
          })
          .where(eq(draftEbooks.id, draft.id));

        if (catalog) {
          await db
            .update(books)
            .set({
              visible: true,
              coverUrl,
              sourceDraftId: draft.id,
            })
            .where(eq(books.id, catalog.id));
        }
      }

      results.push({
        draftId: draft.id,
        title,
        action: restorePublished || needsDeferred ? "deferred" : "skipped",
        coverUrl,
        note: [
          "Local cover file already present",
          restorePublished ? "restored published + catalog" : undefined,
          needsDeferred ? "marked deferred" : undefined,
        ]
          .filter(Boolean)
          .join("; "),
      });
      continue;
    }

    // 1) Production draft API (same id)
    const prod = prodById.get(draft.id);
    if (prod?.coverUrl && (await coverExistsOnProduction(prod.coverUrl))) {
      coverUrl = prod.coverUrl;
      backgroundUrl = prod.backgroundUrl || prod.coverUrl;
      source = "production";
      note = "Matched production draft API";
    }

    // 2) Catalog by sourceDraftId
    if (!coverUrl && catalogByDraftId.has(draft.id)) {
      const cat = catalogByDraftId.get(draft.id)!;
      if (await coverExistsOnProduction(cat)) {
        coverUrl = cat;
        backgroundUrl = cat;
        source = "catalog";
        note = "Catalog sourceDraftId";
      }
    }

    // 3) Catalog by title
    if (!coverUrl) {
      const cat = catalogByTitle.get(title.trim().toLowerCase());
      if (cat && (await coverExistsOnProduction(cat))) {
        coverUrl = cat;
        backgroundUrl = cat;
        source = "catalog";
        note = "Catalog title match";
      }
    }

    // 4) Keep stored URL if production still serves it
    if (!coverUrl && draft.coverUrl && (await coverExistsOnProduction(draft.coverUrl))) {
      coverUrl = draft.coverUrl;
      backgroundUrl = draft.backgroundUrl || draft.coverUrl;
      source = "production";
      note = "Existing DB URL verified on production";
    }

    // 5) Deferred block URL
    if (!coverUrl && existingDeferred?.coverUrl) {
      if (await coverExistsOnProduction(existingDeferred.coverUrl)) {
        coverUrl = existingDeferred.coverUrl;
        backgroundUrl = existingDeferred.backgroundUrl || existingDeferred.coverUrl;
        source = existingDeferred.source;
        note = "Prior deferred metadata";
      }
    }

    if (!coverUrl) {
      results.push({
        draftId: draft.id,
        title,
        action: "failed",
        coverUrl: null,
        note: "No recoverable cover found on production or catalog",
      });
      continue;
    }

    const downloaded = await downloadCoverIfMissing(coverUrl);
    const action: CoverRecoveryResult["action"] = downloaded ? "recovered" : "deferred";

    if (dryRun) {
      results.push({ draftId: draft.id, title, action, coverUrl, source, note: `${note}; dry-run` });
      continue;
    }

    const description = withCoverDeferredInDescription(
      stripCoverDeferredFromDescription(draft.description),
      {
        source: source || "manual",
        coverUrl,
        backgroundUrl,
        recoveredAt: new Date().toISOString(),
        deferRegen: true,
        note: downloaded
          ? `Local file restored. ${note || ""}`.trim()
          : `Production URL only — regen deferred. ${note || ""}`.trim(),
      },
    );

    const catalog = findCatalogLinkInMemory(draft.id, title, catalogRowByDraftId, catalogRowByTitle);
    const restorePublished = catalog != null && draft.status === "ready";

    await db
      .update(draftEbooks)
      .set({
        coverUrl,
        backgroundUrl: backgroundUrl || coverUrl,
        description,
        overlayApproved: true,
        ...(restorePublished
          ? { status: "published", publishedAt: draft.publishedAt ?? new Date() }
          : {}),
      })
      .where(eq(draftEbooks.id, draft.id));

    if (catalog) {
      await db
        .update(books)
        .set({
          visible: true,
          coverUrl,
          sourceDraftId: draft.id,
        })
        .where(eq(books.id, catalog.id));
    }

    results.push({
      draftId: draft.id,
      title,
      action,
      coverUrl,
      source,
      note: [
        downloaded ? note : `${note}; serving via production until local download`,
        restorePublished ? "restored published + catalog" : undefined,
      ]
        .filter(Boolean)
        .join("; "),
    });
  }

  return results;
}

/** Re-publish demoted drafts (ready) that have covers and a matching catalog row (by id or title). */
export async function republishReadyDraftsWithCatalogCovers(options?: {
  dryRun?: boolean;
}): Promise<{ republished: number; drafts: { id: number; title: string; bookId: number }[] }> {
  const dryRun = options?.dryRun ?? false;
  const ready = await db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      status: draftEbooks.status,
      coverUrl: draftEbooks.coverUrl,
      backgroundUrl: draftEbooks.backgroundUrl,
      description: draftEbooks.description,
      publishedAt: draftEbooks.publishedAt,
    })
    .from(draftEbooks)
    .where(eq(draftEbooks.status, "ready"));

  const catalogRows = await db
    .select({
      id: books.id,
      title: books.title,
      sourceDraftId: books.sourceDraftId,
      visible: books.visible,
      coverUrl: books.coverUrl,
    })
    .from(books);

  const byDraftId = new Map<number, CatalogLink>();
  const byTitle = new Map<string, CatalogLink>();
  for (const row of catalogRows) {
    const link: CatalogLink = { id: row.id, visible: row.visible, coverUrl: row.coverUrl };
    if (row.sourceDraftId) byDraftId.set(row.sourceDraftId, link);
    if (row.title) {
      const key = row.title.trim().toLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, link);
    }
  }

  const { draftHasPublishableCover } = await import("./coverStorage");
  const republished: { id: number; title: string; bookId: number }[] = [];

  for (const draft of ready) {
    const title = draft.title || `Draft #${draft.id}`;
    if (!draftHasPublishableCover(draft)) continue;
    const catalog = findCatalogLinkInMemory(draft.id, title, byDraftId, byTitle);
    if (!catalog) continue;

    const coverUrl = draft.coverUrl || draft.backgroundUrl || catalog.coverUrl || "";
    if (!dryRun) {
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
          coverUrl,
          sourceDraftId: draft.id,
        })
        .where(eq(books.id, catalog.id));
    }

    republished.push({ id: draft.id, title, bookId: catalog.id });
    console.log(
      `[Republish] ${dryRun ? "DRY RUN — " : ""}#${draft.id} "${title}" → published; catalog #${catalog.id} visible`,
    );
  }

  return { republished: republished.length, drafts: republished };
}

/** Clear deferred marker when user is ready to regen in Cover Review. */
export async function clearCoverDeferredRegen(draftId: number): Promise<void> {
  const [draft] = await db
    .select({ description: draftEbooks.description })
    .from(draftEbooks)
    .where(eq(draftEbooks.id, draftId));
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  await db
    .update(draftEbooks)
    .set({ description: stripCoverDeferredFromDescription(draft.description) || null })
    .where(eq(draftEbooks.id, draftId));
}
