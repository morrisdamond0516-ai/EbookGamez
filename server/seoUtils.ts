/**
 * Server-side SEO helpers — inject the correct canonical URL into the HTML
 * shell before it is sent to the browser (or Googlebot).
 *
 * This ensures crawlers see the right canonical in the initial response
 * without waiting for React to hydrate and run its useEffect.
 */

/** Book data needed for Open Graph injection. */
export interface BookOGData {
  id: number;
  title: string;
  description: string | null;
  coverUrl: string;
}

const BASE_URL = "https://ebookgamez.com";

/** All valid genre slugs that have dedicated landing pages. */
const VALID_GENRE_SLUGS = new Set([
  "romance",
  "thriller",
  "fantasy",
  "sci-fi",
  "self-help",
  "mystery",
  "horror",
  "biography",
  "business",
  "classic-literature",
  "adventure",
  "history",
]);

interface GenreMeta {
  title: string;
  description: string;
}

/** Per-genre Open Graph copy. */
const GENRE_META: Record<string, GenreMeta> = {
  romance: {
    title: "Romance Ebooks — EbookGamez",
    description:
      "Fall in love with our collection of romance ebooks. From sweet contemporary love stories to passionate historical dramas — find your next favourite romance on EbookGamez.",
  },
  thriller: {
    title: "Thriller Ebooks — EbookGamez",
    description:
      "Keep the pages turning with heart-pounding thriller ebooks. Suspense, crime, and psychological twists await — browse our thriller library on EbookGamez.",
  },
  fantasy: {
    title: "Fantasy Ebooks — EbookGamez",
    description:
      "Step into magical worlds with our fantasy ebook collection. Epic quests, mythical creatures, and rich world-building — explore fantasy on EbookGamez.",
  },
  "sci-fi": {
    title: "Sci-Fi Ebooks — EbookGamez",
    description:
      "Journey to the future with our science fiction ebook library. Space exploration, AI, dystopia, and beyond — discover sci-fi on EbookGamez.",
  },
  "self-help": {
    title: "Self-Help Ebooks — EbookGamez",
    description:
      "Unlock your potential with our self-help ebook collection. Productivity, mindset, wellness, and personal growth — start your journey on EbookGamez.",
  },
  mystery: {
    title: "Mystery Ebooks — EbookGamez",
    description:
      "Unravel gripping whodunits with our mystery ebook collection. Detective stories, crime puzzles, and suspenseful plots — solve the case on EbookGamez.",
  },
  horror: {
    title: "Horror Ebooks — EbookGamez",
    description:
      "Dare to read with our horror ebook library. Spine-chilling tales, psychological horror, and supernatural scares — face your fears on EbookGamez.",
  },
  biography: {
    title: "Biography Ebooks — EbookGamez",
    description:
      "Be inspired by remarkable lives. Browse biographies and memoirs of visionaries, leaders, and icons — read their stories on EbookGamez.",
  },
  business: {
    title: "Business Ebooks — EbookGamez",
    description:
      "Sharpen your business skills with our curated collection. Strategy, entrepreneurship, leadership, and finance — grow your career on EbookGamez.",
  },
  "classic-literature": {
    title: "Classic Literature Ebooks — EbookGamez",
    description:
      "Rediscover timeless masterpieces from the world's greatest authors. Browse free and premium classic literature ebooks on EbookGamez.",
  },
  adventure: {
    title: "Adventure Ebooks — EbookGamez",
    description:
      "Embark on thrilling journeys with our adventure ebook library. Action-packed stories, daring heroes, and exotic locations — your adventure starts on EbookGamez.",
  },
  history: {
    title: "History Ebooks — EbookGamez",
    description:
      "Explore the past with our history ebook collection. Wars, civilisations, biographies, and turning points — discover history on EbookGamez.",
  },
};

/** Meta for the /ebooks hub page. */
const EBOOKS_META: GenreMeta = {
  title: "Browse All Ebooks — EbookGamez",
  description:
    "Explore 600+ full-length ebooks across romance, thriller, fantasy, sci-fi, self-help, mystery, horror, and more. Subscribe to the Reading Pass for unlimited reading on EbookGamez.",
};

/**
 * Resolve the page path to a canonical URL string and optional page meta,
 * or return null for paths we don't handle.
 *
 * `meta` is null for book pages — we don't have book-specific copy available
 * synchronously, so OG tags are left at their template defaults for those pages.
 */
function resolvePageMeta(
  urlPath: string,
): { canonical: string; meta: GenreMeta | null } | null {
  const cleanPath = urlPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

  if (cleanPath === "/ebooks") {
    return { canonical: `${BASE_URL}/ebooks`, meta: EBOOKS_META };
  }

  const genreMatch = cleanPath.match(/^\/ebooks\/([^/]+)$/);
  if (genreMatch) {
    const slug = genreMatch[1].toLowerCase();
    if (VALID_GENRE_SLUGS.has(slug) && GENRE_META[slug]) {
      return {
        canonical: `${BASE_URL}/ebooks/${slug}`,
        meta: GENRE_META[slug],
      };
    }
  }

  // Individual book pages — /book/:id, /books/:id, and /catalog/:id all canonicalise to /book/:id
  const bookMatch = cleanPath.match(/^\/(?:books?|catalog)\/(\d+)(?:\/.*)?$/);
  if (bookMatch) {
    const bookId = bookMatch[1];
    return { canonical: `${BASE_URL}/book/${bookId}`, meta: null };
  }

  return null;
}

/**
 * Replace the static `<link rel="canonical">` tag in `html` with the correct
 * URL for the given request path.
 *
 * Rules:
 *  - /ebooks              → https://ebookgamez.com/ebooks
 *  - /ebooks/<valid-slug> → https://ebookgamez.com/ebooks/<slug>
 *  - /book/:id            → https://ebookgamez.com/book/:id
 *  - /catalog/:id         → https://ebookgamez.com/book/:id  (normalised)
 *  - everything else      → leave the existing canonical unchanged
 */
export function injectCanonical(html: string, urlPath: string): string {
  const page = resolvePageMeta(urlPath);
  if (!page) return html;

  return html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${page.canonical}" />`,
  );
}

/**
 * Extract the numeric book ID from a book-detail URL, or return null if the
 * path is not a book page.  Handles /book/:id, /books/:id, /catalog/:id.
 */
export function extractBookId(urlPath: string): number | null {
  const cleanPath = urlPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  const m = cleanPath.match(/^\/(?:books?|catalog)\/(\d+)(?:\/.*)?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Escape characters that would break an HTML attribute value. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Inject book-specific Open Graph / Twitter Card tags into `html`.
 * Called after fetching the book record from the database.
 */
export function injectBookOpenGraph(html: string, book: BookOGData): string {
  const canonical = `${BASE_URL}/book/${book.id}`;
  const title = escapeAttr(`${book.title} — EbookGamez`);

  // Build a description: use the book's own description, truncated to ~160 chars.
  const rawDesc = (book.description ?? "").trim();
  const desc = escapeAttr(
    rawDesc.length > 160 ? rawDesc.slice(0, 157).trimEnd() + "…" : rawDesc || `Read "${book.title}" on EbookGamez.`,
  );

  // Resolve cover image to an absolute URL.
  const cover = book.coverUrl.startsWith("http")
    ? book.coverUrl
    : `${BASE_URL}${book.coverUrl.startsWith("/") ? "" : "/"}${book.coverUrl}`;
  const coverAttr = escapeAttr(cover);

  let result = html;

  // Update the <title> tag.
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Update the plain <meta name="description"> tag.
  result = result.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${desc}" />`);

  result = result.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`);
  result = result.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`);
  result = result.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${desc}" />`);
  result = result.replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${coverAttr}" />`);
  result = result.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`);
  result = result.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${desc}" />`);
  result = result.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${coverAttr}" />`);

  return result;
}

/**
 * Replace the hardcoded og:url, og:title, og:description, twitter:title, and
 * twitter:description meta tags with page-specific values for genre and /ebooks
 * paths. Book pages have no synchronous meta copy, so their OG tags are left
 * at template defaults. All other paths are left untouched.
 */
export function injectOpenGraph(html: string, urlPath: string): string {
  const page = resolvePageMeta(urlPath);
  // No resolved page, or a book page without genre-level meta copy — leave tags as-is.
  if (!page || !page.meta) return html;

  const { canonical, meta } = page;

  let result = html;

  // og:url
  result = result.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  );

  // og:title
  result = result.replace(
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${meta.title}" />`,
  );

  // og:description
  result = result.replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${meta.description}" />`,
  );

  // twitter:title
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${meta.title}" />`,
  );

  // twitter:description
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${meta.description}" />`,
  );

  return result;
}
