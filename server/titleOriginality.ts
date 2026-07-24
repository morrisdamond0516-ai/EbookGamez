/**
 * External title originality checks (Open Library + Google Books).
 * Classic / public-domain catalog titles are exempt when genre starts with "Classic".
 * AI-authored EbookGamez titles must not exactly (or nearly) match an existing published book.
 */
export type ExternalTitleHit = {
  source: "openlibrary" | "googlebooks";
  title: string;
  authors: string[];
  year?: number | null;
  matchKind: "exact" | "near";
};

export type TitleOriginalityResult = {
  ok: boolean;
  title: string;
  normalized: string;
  collisions: ExternalTitleHit[];
  checkedAt: string;
  error?: string;
};

export function normalizeTitleForOriginality(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Genres we publish as public-domain reprints — skip external collision blocking. */
export function isClassicOrPublicDomainGenre(genre: string | null | undefined): boolean {
  const g = (genre || "").trim().toLowerCase();
  return g.startsWith("classic");
}

function wordSet(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((w) => w.length > 2));
}

function classifyMatch(ours: string, theirs: string): "exact" | "near" | null {
  const a = normalizeTitleForOriginality(ours);
  const b = normalizeTitleForOriginality(theirs);
  if (!a || !b) return null;
  if (a === b) return "exact";
  // Plural / tiny variant: "star whale" vs "star whales"
  if (a.replace(/s\b/g, "") === b.replace(/s\b/g, "") && a.length >= 10) return "near";
  if (a.length >= 12 && (b.includes(a) || a.includes(b))) return "near";
  const aw = wordSet(a);
  const bw = [...wordSet(b)];
  if (aw.size < 3) return null;
  const hit = bw.filter((w) => aw.has(w)).length;
  if (hit >= Math.min(aw.size, 4) && hit / aw.size >= 0.8) return "near";
  return null;
}

async function searchOpenLibrary(title: string): Promise<ExternalTitleHit[]> {
  const url =
    "https://openlibrary.org/search.json?title=" +
    encodeURIComponent(title) +
    "&limit=8";
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return [];
  const j = (await r.json()) as {
    docs?: Array<{ title?: string; author_name?: string[]; first_publish_year?: number }>;
  };
  const hits: ExternalTitleHit[] = [];
  for (const d of j.docs || []) {
    const kind = classifyMatch(title, d.title || "");
    if (!kind) continue;
    hits.push({
      source: "openlibrary",
      title: d.title || "",
      authors: d.author_name || [],
      year: d.first_publish_year ?? null,
      matchKind: kind,
    });
  }
  return hits;
}

async function searchGoogleBooks(title: string): Promise<ExternalTitleHit[]> {
  const url =
    "https://www.googleapis.com/books/v1/volumes?q=intitle:" +
    encodeURIComponent(title) +
    "&maxResults=8";
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return [];
  const j = (await r.json()) as {
    items?: Array<{
      volumeInfo?: { title?: string; authors?: string[]; publishedDate?: string };
    }>;
  };
  const hits: ExternalTitleHit[] = [];
  for (const item of j.items || []) {
    const info = item.volumeInfo || {};
    const kind = classifyMatch(title, info.title || "");
    if (!kind) continue;
    const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) : null;
    hits.push({
      source: "googlebooks",
      title: info.title || "",
      authors: info.authors || [],
      year: Number.isFinite(year) ? year : null,
      matchKind: kind,
    });
  }
  return hits;
}

/**
 * Returns ok:false when an external catalog has an exact or near title match.
 * Network failures return ok:true with error set (fail-open) so production is not
 * halted offline — callers may choose fail-closed for new placers.
 */
export async function checkTitleOriginality(
  title: string,
  opts?: { failClosedOnNetworkError?: boolean; genre?: string | null },
): Promise<TitleOriginalityResult> {
  const cleaned = (title || "").trim();
  const checkedAt = new Date().toISOString();
  const normalized = normalizeTitleForOriginality(cleaned);

  if (!cleaned || cleaned.length < 3) {
    return { ok: false, title: cleaned, normalized, collisions: [], checkedAt, error: "Title too short" };
  }

  if (isClassicOrPublicDomainGenre(opts?.genre)) {
    return { ok: true, title: cleaned, normalized, collisions: [], checkedAt };
  }

  try {
    const [ol, gb] = await Promise.all([searchOpenLibrary(cleaned), searchGoogleBooks(cleaned)]);
    const collisions = [...ol, ...gb];
    // Prefer exact hits; near matches also block for AI-authored books
    const blocking = collisions.filter((c) => c.matchKind === "exact" || c.matchKind === "near");
    return {
      ok: blocking.length === 0,
      title: cleaned,
      normalized,
      collisions: blocking,
      checkedAt,
    };
  } catch (e: any) {
    const error = e?.message || String(e);
    if (opts?.failClosedOnNetworkError) {
      return { ok: false, title: cleaned, normalized, collisions: [], checkedAt, error };
    }
    console.warn(`[TitleOriginality] Network error (fail-open): ${error}`);
    return { ok: true, title: cleaned, normalized, collisions: [], checkedAt, error };
  }
}

/** Short human summary for logs / toasts. */
export function formatTitleCollisions(result: TitleOriginalityResult): string {
  if (result.ok) return "OK — no external title match";
  return result.collisions
    .slice(0, 5)
    .map(
      (c) =>
        `${c.matchKind.toUpperCase()} "${c.title}" (${c.authors.slice(0, 2).join(", ") || "unknown"}, ${c.source})`,
    )
    .join("; ");
}
