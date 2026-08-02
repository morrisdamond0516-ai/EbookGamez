/**
 * Regression tests for genre landing pages (/ebooks/romance, /ebooks/thriller,
 * etc.) and the /ebooks hub server-injected meta tags.
 *
 * Any future change to GENRE_META, EBOOKS_META, resolvePageMeta, injectCanonical,
 * or injectOpenGraph that silently drops or corrupts a tag will be caught here
 * before it reaches production.
 *
 * Checks per page:
 *   - <title>
 *   - <link rel="canonical">
 *   - og:url, og:title, og:description
 *
 * Also verifies that an invalid genre slug falls through to defaults (tags left
 * unchanged by the injection helpers).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { injectCanonical, injectOpenGraph, injectEbooksJsonLd, injectEbookLandingMeta, type EbookLandingData } from "./seoUtils";

// ---------------------------------------------------------------------------
// Minimal HTML shell that mirrors the tags the production index.html contains.
// ---------------------------------------------------------------------------

const DEFAULT_TITLE = "EbookGamez — Ebooks, Games &amp; More";
const DEFAULT_CANONICAL = "https://ebookgamez.com/";
const DEFAULT_OG_URL = "https://ebookgamez.com/";
const DEFAULT_OG_TITLE = "EbookGamez";
const DEFAULT_OG_DESC = "Default OG description.";

const DEFAULT_OG_IMAGE = "https://ebookgamez.com/og-default.jpg";
const DEFAULT_TWITTER_IMAGE = "https://ebookgamez.com/twitter-default.jpg";

const BASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${DEFAULT_TITLE}</title>
  <meta name="description" content="Default description." />
  <link rel="canonical" href="${DEFAULT_CANONICAL}" />
  <meta property="og:url" content="${DEFAULT_OG_URL}" />
  <meta property="og:title" content="${DEFAULT_OG_TITLE}" />
  <meta property="og:description" content="${DEFAULT_OG_DESC}" />
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
  <meta name="twitter:title" content="EbookGamez" />
  <meta name="twitter:description" content="Default twitter description." />
  <meta name="twitter:image" content="${DEFAULT_TWITTER_IMAGE}" />
</head>
<body><div id="root"></div></body>
</html>`;

// ---------------------------------------------------------------------------
// Helper — apply the injection pipeline used by the production server
// ---------------------------------------------------------------------------

function applyInjections(html: string, urlPath: string): string {
  return injectOpenGraph(injectCanonical(html, urlPath), urlPath);
}

/**
 * Apply the full production pipeline including the JSON-LD injector.
 * Mirrors the chain in server/vite.ts and server/static.ts:
 *   injectCanonical → injectOpenGraph → injectProductAppJsonLd (omitted here,
 *   irrelevant for /ebooks paths) → injectEbooksJsonLd
 */
function applyFullPipeline(html: string, urlPath: string): string {
  const withCanonical = injectCanonical(html, urlPath);
  const withOg = injectOpenGraph(withCanonical, urlPath);
  return injectEbooksJsonLd(withOg, urlPath);
}

// ---------------------------------------------------------------------------
// /ebooks hub
// ---------------------------------------------------------------------------

describe("/ebooks hub meta tag injection", () => {
  let html: string;

  beforeEach(() => {
    html = applyInjections(BASE_HTML, "/ebooks");
  });

  it("sets the correct <title>", () => {
    expect(html).toContain("<title>Browse All Ebooks — EbookGamez</title>");
  });

  it("sets the correct canonical URL", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks" />`,
    );
  });

  it("sets og:url to https://ebookgamez.com/ebooks", () => {
    expect(html).toContain(
      `<meta property="og:url" content="https://ebookgamez.com/ebooks" />`,
    );
  });

  it("sets og:title to the /ebooks hub title", () => {
    expect(html).toContain(
      `<meta property="og:title" content="Browse All Ebooks — EbookGamez" />`,
    );
  });

  it("sets og:description to the /ebooks hub description", () => {
    expect(html).toContain(`<meta property="og:description" content="`);
    expect(html).toMatch(/og:description.*Reading Pass/s);
  });

  it("does not leave default canonical in place", () => {
    expect(html).not.toContain(
      `<link rel="canonical" href="${DEFAULT_CANONICAL}" />`,
    );
  });

  it("/ebooks/ (trailing slash) resolves identically", () => {
    const withSlash = applyInjections(BASE_HTML, "/ebooks/");
    expect(withSlash).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks" />`,
    );
    expect(withSlash).toContain(
      `<meta property="og:title" content="Browse All Ebooks — EbookGamez" />`,
    );
  });

  it("/ebooks?ref=nav (query string) resolves identically", () => {
    const withQuery = applyInjections(BASE_HTML, "/ebooks?ref=nav");
    expect(withQuery).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks" />`,
    );
    expect(withQuery).toContain(
      `<meta property="og:title" content="Browse All Ebooks — EbookGamez" />`,
    );
  });
});

// ---------------------------------------------------------------------------
// /ebooks/romance
// ---------------------------------------------------------------------------

describe("/ebooks/romance meta tag injection", () => {
  let html: string;

  beforeEach(() => {
    html = applyInjections(BASE_HTML, "/ebooks/romance");
  });

  it("sets the correct <title>", () => {
    expect(html).toContain("<title>Romance Ebooks — EbookGamez</title>");
  });

  it("sets the correct canonical URL", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks/romance" />`,
    );
  });

  it("sets og:url to https://ebookgamez.com/ebooks/romance", () => {
    expect(html).toContain(
      `<meta property="og:url" content="https://ebookgamez.com/ebooks/romance" />`,
    );
  });

  it("sets og:title to the romance genre title", () => {
    expect(html).toContain(
      `<meta property="og:title" content="Romance Ebooks — EbookGamez" />`,
    );
  });

  it("sets og:description to the romance genre description", () => {
    expect(html).toContain(`<meta property="og:description" content="`);
    expect(html).toMatch(/og:description.*romance/is);
  });

  it("does not leave the default og:title in place", () => {
    expect(html).not.toContain(
      `<meta property="og:title" content="${DEFAULT_OG_TITLE}" />`,
    );
  });
});

// ---------------------------------------------------------------------------
// /ebooks/thriller (spot-check a second genre)
// ---------------------------------------------------------------------------

describe("/ebooks/thriller meta tag injection", () => {
  let html: string;

  beforeEach(() => {
    html = applyInjections(BASE_HTML, "/ebooks/thriller");
  });

  it("sets the correct <title>", () => {
    expect(html).toContain("<title>Thriller Ebooks — EbookGamez</title>");
  });

  it("sets the correct canonical URL", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks/thriller" />`,
    );
  });

  it("sets og:url to https://ebookgamez.com/ebooks/thriller", () => {
    expect(html).toContain(
      `<meta property="og:url" content="https://ebookgamez.com/ebooks/thriller" />`,
    );
  });

  it("sets og:title to the thriller genre title", () => {
    expect(html).toContain(
      `<meta property="og:title" content="Thriller Ebooks — EbookGamez" />`,
    );
  });

  it("sets og:description to the thriller genre description", () => {
    expect(html).toMatch(/og:description.*thriller/is);
  });
});

// ---------------------------------------------------------------------------
// Invalid / unknown genre slug — tags must fall through to template defaults
// ---------------------------------------------------------------------------

describe("invalid genre slug falls through to defaults", () => {
  const INVALID_PATHS = [
    "/ebooks/not-a-real-genre",
    "/ebooks/ROMANCE",         // case must be normalised — ROMANCE is lower-cased internally, so this should actually resolve; test with a truly unknown slug
    "/ebooks/cooking",
    "/ebooks/sports",
    "/ebooks/",                // bare /ebooks/ should resolve to hub, not "invalid"
  ];

  it("/ebooks/cooking leaves canonical unchanged", () => {
    const html = applyInjections(BASE_HTML, "/ebooks/cooking");
    expect(html).toContain(
      `<link rel="canonical" href="${DEFAULT_CANONICAL}" />`,
    );
  });

  it("/ebooks/cooking leaves og:title unchanged", () => {
    const html = applyInjections(BASE_HTML, "/ebooks/cooking");
    expect(html).toContain(
      `<meta property="og:title" content="${DEFAULT_OG_TITLE}" />`,
    );
  });

  it("/ebooks/cooking leaves og:url unchanged", () => {
    const html = applyInjections(BASE_HTML, "/ebooks/cooking");
    expect(html).toContain(
      `<meta property="og:url" content="${DEFAULT_OG_URL}" />`,
    );
  });

  it("/ebooks/not-a-real-genre leaves og:description unchanged", () => {
    const html = applyInjections(BASE_HTML, "/ebooks/not-a-real-genre");
    expect(html).toContain(
      `<meta property="og:description" content="${DEFAULT_OG_DESC}" />`,
    );
  });
});

// ---------------------------------------------------------------------------
// Case normalisation — slug matching is case-insensitive
// ---------------------------------------------------------------------------

describe("genre slug case normalisation", () => {
  it("/ebooks/ROMANCE resolves the same as /ebooks/romance", () => {
    const upper = applyInjections(BASE_HTML, "/ebooks/ROMANCE");
    const lower = applyInjections(BASE_HTML, "/ebooks/romance");
    expect(upper).toBe(lower);
  });

  it("/ebooks/Thriller resolves the same as /ebooks/thriller", () => {
    const mixed = applyInjections(BASE_HTML, "/ebooks/Thriller");
    const lower = applyInjections(BASE_HTML, "/ebooks/thriller");
    expect(mixed).toBe(lower);
  });
});

// ---------------------------------------------------------------------------
// All valid genre slugs have a non-empty title and description
// ---------------------------------------------------------------------------

const ALL_GENRE_SLUGS = [
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
];

describe("every valid genre slug injects its own title and canonical", () => {
  for (const slug of ALL_GENRE_SLUGS) {
    it(`/ebooks/${slug} sets a genre-specific og:title`, () => {
      const html = applyInjections(BASE_HTML, `/ebooks/${slug}`);
      // Must not be the default template title
      expect(html).not.toContain(
        `<meta property="og:title" content="${DEFAULT_OG_TITLE}" />`,
      );
      // Must contain the expected canonical
      expect(html).toContain(
        `<link rel="canonical" href="https://ebookgamez.com/ebooks/${slug}" />`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// JSON-LD structured-data tests
// ---------------------------------------------------------------------------

/**
 * Extract and parse every <script type="application/ld+json"> block from html.
 * Returns an array of parsed objects (one per block).
 */
function extractJsonLdBlocks(html: string): object[] {
  const blocks: object[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    blocks.push(JSON.parse(m[1]));
  }
  return blocks;
}

describe("/ebooks hub JSON-LD injection", () => {
  let html: string;
  let blocks: object[];

  beforeEach(() => {
    html = injectEbooksJsonLd(BASE_HTML, "/ebooks");
    blocks = extractJsonLdBlocks(html);
  });

  it("injects exactly one JSON-LD block", () => {
    expect(blocks).toHaveLength(1);
  });

  it("the JSON-LD block is valid, parseable JSON", () => {
    // extractJsonLdBlocks would have thrown if parsing failed; reaching here
    // means it is valid JSON.
    expect(blocks[0]).toBeDefined();
  });

  it("the JSON-LD block has @context of https://schema.org", () => {
    expect((blocks[0] as any)["@context"]).toBe("https://schema.org");
  });

  it("the JSON-LD block has @type of WebSite", () => {
    expect((blocks[0] as any)["@type"]).toBe("WebSite");
  });

  it("the JSON-LD url points to /ebooks", () => {
    expect((blocks[0] as any).url).toBe("https://ebookgamez.com/ebooks");
  });

  it("the JSON-LD name is non-empty", () => {
    expect(typeof (blocks[0] as any).name).toBe("string");
    expect((blocks[0] as any).name.length).toBeGreaterThan(0);
  });

  it("the JSON-LD description is non-empty", () => {
    expect(typeof (blocks[0] as any).description).toBe("string");
    expect((blocks[0] as any).description.length).toBeGreaterThan(0);
  });

  it("the JSON-LD block appears before </head>", () => {
    const ldIndex = html.indexOf('type="application/ld+json"');
    const headCloseIndex = html.indexOf("</head>");
    expect(ldIndex).toBeGreaterThan(0);
    expect(ldIndex).toBeLessThan(headCloseIndex);
  });

  it("/ebooks/ (trailing slash) also injects a WebSite JSON-LD block", () => {
    const withSlash = injectEbooksJsonLd(BASE_HTML, "/ebooks/");
    const b = extractJsonLdBlocks(withSlash);
    expect(b).toHaveLength(1);
    expect((b[0] as any)["@type"]).toBe("WebSite");
  });

  it("/ebooks?ref=nav (query string) also injects a WebSite JSON-LD block", () => {
    const withQuery = injectEbooksJsonLd(BASE_HTML, "/ebooks?ref=nav");
    const b = extractJsonLdBlocks(withQuery);
    expect(b).toHaveLength(1);
    expect((b[0] as any)["@type"]).toBe("WebSite");
  });
});

describe("/ebooks/romance JSON-LD injection", () => {
  let blocks: object[];

  beforeEach(() => {
    const html = injectEbooksJsonLd(BASE_HTML, "/ebooks/romance");
    blocks = extractJsonLdBlocks(html);
  });

  it("injects exactly one JSON-LD block", () => {
    expect(blocks).toHaveLength(1);
  });

  it("the JSON-LD block has @type of CollectionPage", () => {
    expect((blocks[0] as any)["@type"]).toBe("CollectionPage");
  });

  it("the JSON-LD url points to /ebooks/romance", () => {
    expect((blocks[0] as any).url).toBe("https://ebookgamez.com/ebooks/romance");
  });

  it("the JSON-LD name matches the romance genre title", () => {
    expect((blocks[0] as any).name).toBe("Romance Ebooks — EbookGamez");
  });

  it("the JSON-LD description mentions romance", () => {
    expect((blocks[0] as any).description).toMatch(/romance/i);
  });

  it("isPartOf is a WebSite pointing to the root domain", () => {
    const isPartOf = (blocks[0] as any).isPartOf;
    expect(isPartOf).toBeDefined();
    expect(isPartOf["@type"]).toBe("WebSite");
    expect(isPartOf.url).toBe("https://ebookgamez.com");
  });
});

describe("every valid genre slug injects a CollectionPage JSON-LD block", () => {
  for (const slug of ALL_GENRE_SLUGS) {
    it(`/ebooks/${slug} injects a CollectionPage JSON-LD block`, () => {
      const html = injectEbooksJsonLd(BASE_HTML, `/ebooks/${slug}`);
      const blocks = extractJsonLdBlocks(html);
      expect(blocks).toHaveLength(1);
      expect((blocks[0] as any)["@type"]).toBe("CollectionPage");
      expect((blocks[0] as any).url).toBe(
        `https://ebookgamez.com/ebooks/${slug}`,
      );
    });
  }
});

describe("JSON-LD is not injected for unknown/unhandled paths", () => {
  it("an unknown genre slug injects no JSON-LD block", () => {
    const html = injectEbooksJsonLd(BASE_HTML, "/ebooks/cooking");
    expect(extractJsonLdBlocks(html)).toHaveLength(0);
  });

  it("a non-ebooks path injects no JSON-LD block", () => {
    const html = injectEbooksJsonLd(BASE_HTML, "/games");
    expect(extractJsonLdBlocks(html)).toHaveLength(0);
  });

  it("a book detail path injects no JSON-LD block", () => {
    const html = injectEbooksJsonLd(BASE_HTML, "/book/123");
    expect(extractJsonLdBlocks(html)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pipeline integration tests — mirror the full server/vite.ts + server/static.ts
// chain: injectCanonical → injectOpenGraph → injectEbooksJsonLd
// These tests verify that the JSON-LD injector cooperates correctly with the
// rest of the pipeline so a missed wiring step is detected immediately.
// ---------------------------------------------------------------------------

describe("full pipeline: /ebooks hub emits WebSite JSON-LD", () => {
  let html: string;
  let blocks: object[];

  beforeEach(() => {
    html = applyFullPipeline(BASE_HTML, "/ebooks");
    blocks = extractJsonLdBlocks(html);
  });

  it("pipeline produces exactly one JSON-LD block", () => {
    expect(blocks).toHaveLength(1);
  });

  it("pipeline JSON-LD has @type WebSite", () => {
    expect((blocks[0] as any)["@type"]).toBe("WebSite");
  });

  it("pipeline still sets og:title correctly", () => {
    expect(html).toContain(
      `<meta property="og:title" content="Browse All Ebooks — EbookGamez" />`,
    );
  });

  it("pipeline still sets canonical correctly", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks" />`,
    );
  });
});

describe("full pipeline: /ebooks/romance emits CollectionPage JSON-LD", () => {
  let blocks: object[];
  let html: string;

  beforeEach(() => {
    html = applyFullPipeline(BASE_HTML, "/ebooks/romance");
    blocks = extractJsonLdBlocks(html);
  });

  it("pipeline produces exactly one JSON-LD block", () => {
    expect(blocks).toHaveLength(1);
  });

  it("pipeline JSON-LD has @type CollectionPage", () => {
    expect((blocks[0] as any)["@type"]).toBe("CollectionPage");
  });

  it("pipeline CollectionPage url is correct", () => {
    expect((blocks[0] as any).url).toBe("https://ebookgamez.com/ebooks/romance");
  });

  it("pipeline still sets og:title correctly", () => {
    expect(html).toContain(
      `<meta property="og:title" content="Romance Ebooks — EbookGamez" />`,
    );
  });
});

describe("full pipeline: non-ebooks paths produce no JSON-LD", () => {
  it("/games pipeline produces no JSON-LD block", () => {
    const html = applyFullPipeline(BASE_HTML, "/games");
    expect(extractJsonLdBlocks(html)).toHaveLength(0);
  });

  it("/ebooks/cooking pipeline produces no JSON-LD block", () => {
    const html = applyFullPipeline(BASE_HTML, "/ebooks/cooking");
    expect(extractJsonLdBlocks(html)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// injectEbookLandingMeta — Book + Product JSON-LD regression tests
// ---------------------------------------------------------------------------

const SAMPLE_BOOK: EbookLandingData = {
  title: "The Art of Testing",
  description: "A comprehensive guide to software testing practices, covering unit tests, integration tests, and end-to-end automation strategies for modern applications.",
  coverUrl: "/covers/art-of-testing.jpg",
  author: "Jane Developer",
  price: "9.99",
  rating: "4.7",
  genre: "Technology",
  reviewCount: 42,
};

describe("injectEbookLandingMeta — JSON-LD block", () => {
  let html: string;
  let blocks: object[];
  let graph: any[];

  beforeEach(() => {
    html = injectEbookLandingMeta(BASE_HTML, SAMPLE_BOOK);
    blocks = extractJsonLdBlocks(html);
    graph = (blocks[0] as any)["@graph"];
  });

  it("injects exactly one JSON-LD script block", () => {
    expect(blocks).toHaveLength(1);
  });

  it("JSON-LD is parseable (no syntax errors)", () => {
    // extractJsonLdBlocks already JSON.parse'd — reaching here means it parsed
    expect(blocks[0]).toBeDefined();
    expect(typeof blocks[0]).toBe("object");
  });

  it("top-level @context is https://schema.org", () => {
    expect((blocks[0] as any)["@context"]).toBe("https://schema.org");
  });

  it("@graph contains exactly two nodes", () => {
    expect(Array.isArray(graph)).toBe(true);
    expect(graph).toHaveLength(2);
  });

  it("first node has @type Book", () => {
    expect(graph[0]["@type"]).toBe("Book");
  });

  it("second node has @type Product", () => {
    expect(graph[1]["@type"]).toBe("Product");
  });

  it("Book node carries the book name", () => {
    expect(graph[0].name).toBe(SAMPLE_BOOK.title);
  });

  it("Book node carries the author name", () => {
    expect(graph[0].author?.name).toBe(SAMPLE_BOOK.author);
  });

  it("Book node carries a description", () => {
    expect(typeof graph[0].description).toBe("string");
    expect(graph[0].description.length).toBeGreaterThan(0);
  });

  it("Book node carries a url pointing to the canonical ebook page", () => {
    expect(graph[0].url).toContain("/ebooks/b/");
    expect(graph[0].url).toContain("the-art-of-testing");
  });

  it("Product node carries the book name", () => {
    expect(graph[1].name).toBe(SAMPLE_BOOK.title);
  });

  it("Product node has an offers block with the correct price", () => {
    const offers = graph[1].offers;
    expect(offers).toBeDefined();
    expect(offers["@type"]).toBe("Offer");
    expect(offers.price).toBe("9.99");
  });

  it("Product offers.priceCurrency is USD", () => {
    expect(graph[1].offers.priceCurrency).toBe("USD");
  });

  it("Book and Product nodes share the same name", () => {
    expect(graph[0].name).toBe(graph[1].name);
  });
});

describe("injectEbookLandingMeta — JSON-LD with aggregate rating", () => {
  let graph: any[];

  beforeEach(() => {
    const html = injectEbookLandingMeta(BASE_HTML, SAMPLE_BOOK);
    const blocks = extractJsonLdBlocks(html);
    graph = (blocks[0] as any)["@graph"];
  });

  it("Book node contains an aggregateRating block when reviewCount > 0", () => {
    expect(graph[0].aggregateRating).toBeDefined();
    expect(graph[0].aggregateRating["@type"]).toBe("AggregateRating");
  });

  it("aggregateRating carries the expected reviewCount", () => {
    expect(graph[0].aggregateRating.reviewCount).toBe(42);
  });

  it("aggregateRating ratingValue matches supplied rating", () => {
    expect(graph[0].aggregateRating.ratingValue).toBe("4.7");
  });
});

describe("injectEbookLandingMeta — JSON-LD without reviews", () => {
  it("omits aggregateRating when reviewCount is 0", () => {
    const bookNoReviews: EbookLandingData = { ...SAMPLE_BOOK, reviewCount: 0 };
    const html = injectEbookLandingMeta(BASE_HTML, bookNoReviews);
    const blocks = extractJsonLdBlocks(html);
    const graph = (blocks[0] as any)["@graph"];
    expect(graph[0].aggregateRating).toBeUndefined();
    expect(graph[1].aggregateRating).toBeUndefined();
  });

  it("omits aggregateRating when reviewCount is absent", () => {
    const { reviewCount: _omit, ...bookMinimal } = SAMPLE_BOOK;
    const html = injectEbookLandingMeta(BASE_HTML, bookMinimal as EbookLandingData);
    const blocks = extractJsonLdBlocks(html);
    const graph = (blocks[0] as any)["@graph"];
    expect(graph[0].aggregateRating).toBeUndefined();
  });
});

describe("injectEbookLandingMeta — price edge cases", () => {
  it("defaults price to 9.99 when price is not provided", () => {
    const bookNoPrice: EbookLandingData = { ...SAMPLE_BOOK, price: "" };
    const html = injectEbookLandingMeta(BASE_HTML, bookNoPrice);
    const blocks = extractJsonLdBlocks(html);
    const graph = (blocks[0] as any)["@graph"];
    expect(graph[1].offers.price).toBe("9.99");
  });

  it("formats price to two decimal places", () => {
    const bookIntPrice: EbookLandingData = { ...SAMPLE_BOOK, price: "5" };
    const html = injectEbookLandingMeta(BASE_HTML, bookIntPrice);
    const blocks = extractJsonLdBlocks(html);
    const graph = (blocks[0] as any)["@graph"];
    expect(graph[1].offers.price).toBe("5.00");
  });
});

// ---------------------------------------------------------------------------
// injectEbookLandingMeta — meta tag substitution regression tests
// ---------------------------------------------------------------------------

describe("injectEbookLandingMeta — meta tag substitution", () => {
  let html: string;

  beforeEach(() => {
    html = injectEbookLandingMeta(BASE_HTML, SAMPLE_BOOK);
  });

  // <title>
  it("sets <title> to book title suffixed with — EbookGamez", () => {
    expect(html).toContain("<title>The Art of Testing — EbookGamez</title>");
  });

  it("replaces the default <title>", () => {
    expect(html).not.toContain(`<title>${DEFAULT_TITLE}</title>`);
  });

  // canonical
  it("sets <link rel=\"canonical\"> to the /ebooks/b/:slug URL", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/ebooks/b/the-art-of-testing" />`,
    );
  });

  it("replaces the default canonical", () => {
    expect(html).not.toContain(`href="${DEFAULT_CANONICAL}"`);
  });

  // og:url
  it("sets og:url to the canonical /ebooks/b/:slug URL", () => {
    expect(html).toContain(
      `<meta property="og:url" content="https://ebookgamez.com/ebooks/b/the-art-of-testing" />`,
    );
  });

  // og:title
  it("sets og:title to book title suffixed with — EbookGamez", () => {
    expect(html).toContain(
      `<meta property="og:title" content="The Art of Testing — EbookGamez" />`,
    );
  });

  it("replaces the default og:title", () => {
    expect(html).not.toContain(`<meta property="og:title" content="${DEFAULT_OG_TITLE}" />`);
  });

  // og:description
  it("sets og:description to the book description", () => {
    expect(html).toContain(`<meta property="og:description" content="`);
    expect(html).toContain("A comprehensive guide to software testing");
  });

  it("replaces the default og:description", () => {
    expect(html).not.toContain(`<meta property="og:description" content="${DEFAULT_OG_DESC}" />`);
  });

  // og:image
  it("sets og:image to the absolute cover URL", () => {
    expect(html).toContain(
      `<meta property="og:image" content="https://ebookgamez.com/covers/art-of-testing.jpg" />`,
    );
  });

  it("replaces the default og:image", () => {
    expect(html).not.toContain(`<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />`);
  });

  // twitter:title
  it("sets twitter:title to book title suffixed with — EbookGamez", () => {
    expect(html).toContain(
      `<meta name="twitter:title" content="The Art of Testing — EbookGamez" />`,
    );
  });

  // twitter:description
  it("sets twitter:description to the book description", () => {
    expect(html).toContain(`<meta name="twitter:description" content="`);
    expect(html).toContain("A comprehensive guide to software testing");
  });

  // twitter:image
  it("sets twitter:image to the absolute cover URL", () => {
    expect(html).toContain(
      `<meta name="twitter:image" content="https://ebookgamez.com/covers/art-of-testing.jpg" />`,
    );
  });

  it("replaces the default twitter:image", () => {
    expect(html).not.toContain(
      `<meta name="twitter:image" content="${DEFAULT_TWITTER_IMAGE}" />`,
    );
  });
});

describe("injectEbookLandingMeta — cover URL handling", () => {
  it("uses an already-absolute coverUrl unchanged", () => {
    const bookAbsCover: EbookLandingData = {
      ...SAMPLE_BOOK,
      coverUrl: "https://cdn.example.com/cover.jpg",
    };
    const html = injectEbookLandingMeta(BASE_HTML, bookAbsCover);
    expect(html).toContain(
      `<meta property="og:image" content="https://cdn.example.com/cover.jpg" />`,
    );
  });

  it("prepends BASE_URL to a relative coverUrl that starts with /", () => {
    const html = injectEbookLandingMeta(BASE_HTML, SAMPLE_BOOK);
    expect(html).toContain(
      `<meta property="og:image" content="https://ebookgamez.com/covers/art-of-testing.jpg" />`,
    );
  });

  it("og:image and twitter:image are always identical", () => {
    const html = injectEbookLandingMeta(BASE_HTML, SAMPLE_BOOK);
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const twImageMatch = html.match(/<meta name="twitter:image" content="([^"]+)"/);
    expect(ogImageMatch).not.toBeNull();
    expect(twImageMatch).not.toBeNull();
    expect(ogImageMatch![1]).toBe(twImageMatch![1]);
  });
});

describe("injectEbookLandingMeta — description truncation", () => {
  it("truncates description to 160 characters with ellipsis in meta tags", () => {
    const longDesc = "A".repeat(200);
    const bookLongDesc: EbookLandingData = { ...SAMPLE_BOOK, description: longDesc };
    const html = injectEbookLandingMeta(BASE_HTML, bookLongDesc);
    // The injected description content should be truncated (157 chars + ellipsis = 160)
    const match = html.match(/<meta property="og:description" content="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBeLessThanOrEqual(165); // allow for HTML entity encoding
    expect(match![1]).toContain("…");
  });

  it("falls back to default description text when description is empty", () => {
    const bookNoDesc: EbookLandingData = { ...SAMPLE_BOOK, description: "" };
    const html = injectEbookLandingMeta(BASE_HTML, bookNoDesc);
    expect(html).toContain(`Read &quot;The Art of Testing&quot; on EbookGamez.`);
  });
});
