/**
 * Server-side SEO helpers — inject the correct canonical URL into the HTML
 * shell before it is sent to the browser (or Googlebot).
 *
 * This ensures crawlers see the right canonical in the initial response
 * without waiting for React to hydrate and run its useEffect.
 */
import { sql } from "drizzle-orm";
import { books } from "@shared/schema";

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

/** Meta for static landing pages. */
const STATIC_PAGE_META: Record<string, GenreMeta & { path: string }> = {
  "/": {
    path: "/",
    title: "EbookGamez — Ebooks, Games & More",
    description:
      "EbookGamez is your home for 600+ ebooks, word games, and activity guides. Subscribe to the Reading Pass for unlimited access to our full library.",
  },
  "/games": {
    path: "/games",
    title: "Word Games & Puzzles — EbookGamez",
    description:
      "Play free word games and puzzles on EbookGamez. Challenge yourself with trivia, crosswords, and brain-teasers — fun for all ages.",
  },
  "/guides": {
    path: "/guides",
    title: "Reading Guides & Resources — EbookGamez",
    description:
      "Explore reading guides, book summaries, and curated lists on EbookGamez. Find your next great read with help from our expert guides.",
  },
  "/subscription": {
    path: "/subscription",
    title: "Reading Pass Subscription — EbookGamez",
    description:
      "Unlock unlimited reading with the EbookGamez Reading Pass. Access 600+ full-length ebooks for one low monthly or annual price. Start reading today.",
  },
  "/learnforge": {
    path: "/learnforge",
    title: "LearnForge — AI Learning & Career Advancement Tool",
    description:
      "Turn any subject, document, or career goal into a full-length AI-powered practice exam. Fresh questions every time, instant explanations. Free to start — no card needed.",
  },
  "/linksshrink": {
    path: "/linksshrink",
    title: "LinksShrink — Short Links, Video Ads & Click Analytics",
    description:
      "Create branded short links, generate video ads from your links, and track every click with real-time analytics. Everything for smarter ad campaigns in one place.",
  },
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

  // Static landing pages: /, /games, /guides, /subscription
  if (cleanPath in STATIC_PAGE_META) {
    const staticMeta = STATIC_PAGE_META[cleanPath];
    return { canonical: `${BASE_URL}${staticMeta.path}`, meta: staticMeta };
  }

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

  const titleAttr = escapeAttr(meta.title);
  const descAttr = escapeAttr(meta.description);

  let result = html;

  // <title>
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${titleAttr}</title>`);

  // <meta name="description">
  result = result.replace(
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${descAttr}" />`,
  );

  // og:url
  result = result.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonical}" />`,
  );

  // og:title
  result = result.replace(
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${titleAttr}" />`,
  );

  // og:description
  result = result.replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${descAttr}" />`,
  );

  // twitter:title
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${titleAttr}" />`,
  );

  // twitter:description
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${descAttr}" />`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// /ebooks hub + genre page JSON-LD injection
// ---------------------------------------------------------------------------

/** WebSite JSON-LD schema injected for the /ebooks hub. */
const EBOOKS_WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "EbookGamez Ebooks",
  url: `${BASE_URL}/ebooks`,
  description:
    "Explore 600+ full-length ebooks across romance, thriller, fantasy, sci-fi, self-help, mystery, horror, and more. Subscribe to the Reading Pass for unlimited reading.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/catalog?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
  publisher: { "@type": "Organization", name: "EbookGamez", url: BASE_URL },
};

/**
 * Inject a JSON-LD structured-data block before </head> for /ebooks hub and
 * valid genre landing pages (/ebooks/<slug>).
 *
 *  - /ebooks          → WebSite schema
 *  - /ebooks/<slug>   → CollectionPage schema (known slugs only)
 *  - anything else    → html returned unchanged
 */
export function injectEbooksJsonLd(html: string, urlPath: string): string {
  const cleanPath = urlPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

  let jsonLd: object | null = null;

  if (cleanPath === "/ebooks") {
    jsonLd = EBOOKS_WEBSITE_JSON_LD;
  } else {
    const genreMatch = cleanPath.match(/^\/ebooks\/([^/]+)$/);
    if (genreMatch) {
      const slug = genreMatch[1].toLowerCase();
      if (VALID_GENRE_SLUGS.has(slug) && GENRE_META[slug]) {
        const meta = GENRE_META[slug];
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: meta.title,
          url: `${BASE_URL}/ebooks/${slug}`,
          description: meta.description,
          isPartOf: {
            "@type": "WebSite",
            name: "EbookGamez",
            url: BASE_URL,
          },
        };
      }
    }
  }

  if (!jsonLd) return html;
  const tag = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
  return html.replace("</head>", `${tag}\n</head>`);
}

// ---------------------------------------------------------------------------
// Product app JSON-LD injection (/learnforge, /linksshrink)
// ---------------------------------------------------------------------------

const PRODUCT_APP_JSON_LD: Record<string, object> = {
  "/learnforge": {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LearnForge",
    url: "https://knowledge-builder.replit.app/",
    applicationCategory: "EducationApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Turn any subject, document, or career goal into a full-length AI-powered practice exam. Fresh questions every time, instant answer explanations. Free to start.",
    publisher: { "@type": "Organization", name: "EbookGamez", url: BASE_URL },
    featureList: [
      "AI Quiz Builder",
      "Career Path Generator",
      "Practice Exams",
      "Score & Progress Tracking",
      "Upload Any Document",
      "Instant Answer Explanations",
    ],
  },
  "/linksshrink": {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LinksShrink",
    url: "https://linksshrink.com",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Create branded short links, generate video ads from those links, and track every click with real-time analytics. Everything for smarter ad campaigns in one place.",
    publisher: { "@type": "Organization", name: "EbookGamez", url: BASE_URL },
    featureList: [
      "Short Link Creation",
      "Video Ad Generator",
      "Click Analytics",
      "Geo & Device Targeting",
      "Campaign Management",
      "Instant Redirects",
    ],
  },
};

/**
 * For /learnforge and /linksshrink, inject a SoftwareApplication JSON-LD
 * block before </head>. Returns html unchanged for any other path.
 */
export function injectProductAppJsonLd(html: string, urlPath: string): string {
  const cleanPath = urlPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  const jsonLd = PRODUCT_APP_JSON_LD[cleanPath];
  if (!jsonLd) return html;
  const tag = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
  return html.replace("</head>", `${tag}\n</head>`);
}

// ---------------------------------------------------------------------------
// Ebook landing page helpers (/ebooks/b/:slug)
// ---------------------------------------------------------------------------

/** Convert a book title to a URL-safe slug. */
export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Drizzle SQL expression that mirrors toSlug() on the books.title column.
 *
 * Use this in a WHERE clause to find a book by slug with a single targeted
 * query rather than fetching every book into JS memory.  Handles colons,
 * apostrophes, and all other punctuation correctly because both the stored
 * title and the comparison slug go through the same normalisation.
 *
 * Example:
 *   .where(and(eq(books.visible, true), sql`${titleSlugSql} = ${slug}`))
 */
export const titleSlugSql = sql<string>`regexp_replace(regexp_replace(regexp_replace(trim(regexp_replace(lower(${books.title}), '[^a-z0-9 -]', '', 'g')), ' +', '-', 'g'), '-+', '-', 'g'), '^-|-$', '', 'g')`;

/**
 * Extract a book slug from /ebooks/b/:slug URLs, or return null for any other
 * path.
 */
export function extractEbookSlug(urlPath: string): string | null {
  const cleanPath = urlPath.split("?")[0].split("#")[0].replace(/\/$/, "");
  const m = cleanPath.match(/^\/ebooks\/b\/([^/]+)$/);
  return m ? m[1] : null;
}

/** Extended book data required for ebook landing page meta injection. */
export interface EbookLandingData extends BookOGData {
  author: string;
  price: string;
  rating: string;
  genre: string;
  reviewCount?: number;
}

/**
 * Inject a Book + Product JSON-LD block and full per-book meta tags into
 * `html` for /ebooks/b/:slug pages.
 *
 * This is the server-side equivalent of the client's useEffect meta update,
 * so Googlebot sees everything on first crawl.
 */
export function injectEbookLandingMeta(html: string, book: EbookLandingData): string {
  const slug = toSlug(book.title);
  const canonical = `${BASE_URL}/ebooks/b/${slug}`;
  const titleAttr = escapeAttr(`${book.title} — EbookGamez`);

  const rawDesc = (book.description ?? "").trim();
  const descAttr = escapeAttr(
    rawDesc.length > 160 ? rawDesc.slice(0, 157).trimEnd() + "…" : rawDesc || `Read "${book.title}" on EbookGamez.`,
  );

  const cover = book.coverUrl.startsWith("http")
    ? book.coverUrl
    : `${BASE_URL}${book.coverUrl.startsWith("/") ? "" : "/"}${book.coverUrl}`;
  const coverAttr = escapeAttr(cover);

  const price = parseFloat(book.price || "9.99").toFixed(2);
  const rating = parseFloat(book.rating || "4.5").toFixed(1);
  const reviewCount = book.reviewCount ?? 0;
  const fullDesc = rawDesc.slice(0, 500) || `Read "${book.title}" on EbookGamez.`;

  const ratingBlock =
    reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating,
            reviewCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {};

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        "@id": `${canonical}#book`,
        name: book.title,
        author: { "@type": "Person", name: book.author },
        description: fullDesc,
        url: canonical,
        image: cover,
        bookFormat: "https://schema.org/EBook",
        genre: book.genre,
        inLanguage: "en",
        publisher: { "@type": "Organization", name: "EbookGamez", url: BASE_URL },
        ...ratingBlock,
      },
      {
        "@type": "Product",
        "@id": `${canonical}#product`,
        name: book.title,
        description: fullDesc,
        image: cover,
        brand: { "@type": "Brand", name: "EbookGamez" },
        offers: {
          "@type": "Offer",
          url: canonical,
          price,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          seller: { "@type": "Organization", name: "EbookGamez" },
        },
        ...ratingBlock,
      },
    ],
  };

  let result = html;

  // <title>
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${titleAttr}</title>`);

  // canonical
  result = result.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonical}" />`,
  );

  // meta tags
  result = result.replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${descAttr}" />`);
  result = result.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`);
  result = result.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${titleAttr}" />`);
  result = result.replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${descAttr}" />`);
  result = result.replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${coverAttr}" />`);
  result = result.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${titleAttr}" />`);
  result = result.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${descAttr}" />`);
  result = result.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${coverAttr}" />`);

  // Inject JSON-LD before </head>
  const ldTag = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
  result = result.replace("</head>", `${ldTag}\n</head>`);

  return result;
}
