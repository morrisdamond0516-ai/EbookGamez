/**
 * Regression tests for /learnforge and /linksshrink server-injected meta tags.
 *
 * These tests exercise the pure HTML-transform helpers in seoUtils.ts so that
 * any future change to STATIC_PAGE_META or PRODUCT_APP_JSON_LD that silently
 * drops or corrupts a tag is caught before it reaches production.
 *
 * Checks per page:
 *   - <title>
 *   - <link rel="canonical">
 *   - og:title, og:description, og:url
 *   - <script type="application/ld+json"> containing @type SoftwareApplication
 */

import { describe, it, expect } from "vitest";
import {
  injectCanonical,
  injectOpenGraph,
  injectProductAppJsonLd,
} from "./seoUtils";

// ---------------------------------------------------------------------------
// Minimal HTML shell that mirrors the tags the production index.html contains.
// ---------------------------------------------------------------------------

const BASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>EbookGamez — Ebooks, Games &amp; More</title>
  <meta name="description" content="Default description." />
  <link rel="canonical" href="https://ebookgamez.com/" />
  <meta property="og:url" content="https://ebookgamez.com/" />
  <meta property="og:title" content="EbookGamez" />
  <meta property="og:description" content="Default OG description." />
  <meta name="twitter:title" content="EbookGamez" />
  <meta name="twitter:description" content="Default twitter description." />
</head>
<body><div id="root"></div></body>
</html>`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Apply the full injection pipeline used by server/static.ts and server/vite.ts */
function applyInjections(html: string, urlPath: string): string {
  const withCanonical = injectCanonical(html, urlPath);
  const withOG = injectOpenGraph(withCanonical, urlPath);
  return injectProductAppJsonLd(withOG, urlPath);
}

function parseJsonLdBlocks(html: string): object[] {
  const results: object[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      results.push(JSON.parse(m[1]));
    } catch {
      // ignore malformed blocks
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// /learnforge
// ---------------------------------------------------------------------------

describe("/learnforge meta tag injection", () => {
  const path = "/learnforge";
  let html: string;

  beforeEach(() => {
    html = applyInjections(BASE_HTML, path);
  });

  it("sets the correct <title>", () => {
    expect(html).toMatch(
      /<title>LearnForge — AI Learning &amp; Career Advancement Tool<\/title>/,
    );
  });

  it("sets the correct canonical URL", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/learnforge" />`,
    );
  });

  it("sets og:url to https://ebookgamez.com/learnforge", () => {
    expect(html).toContain(
      `<meta property="og:url" content="https://ebookgamez.com/learnforge" />`,
    );
  });

  it("sets og:title to the LearnForge page title", () => {
    expect(html).toContain(
      `<meta property="og:title" content="LearnForge — AI Learning &amp; Career Advancement Tool" />`,
    );
  });

  it("sets og:description to the LearnForge description", () => {
    expect(html).toContain(`<meta property="og:description" content="`);
    // Verify the description contains key LearnForge copy.
    expect(html).toMatch(/og:description.*LearnForge/s);
  });

  it("injects a <script type='application/ld+json'> block", () => {
    expect(html).toContain(`<script type="application/ld+json">`);
  });

  it("JSON-LD block has @type SoftwareApplication", () => {
    const blocks = parseJsonLdBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication");
    expect(app).toBeDefined();
  });

  it("SoftwareApplication block has name 'LearnForge'", () => {
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.name).toBe("LearnForge");
  });

  it("SoftwareApplication block has applicationCategory 'EducationApplication'", () => {
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.applicationCategory).toBe("EducationApplication");
  });

  it("SoftwareApplication block has a free Offer (price '0')", () => {
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.offers?.price).toBe("0");
  });

  it("JSON-LD block is valid JSON (does not throw on parse)", () => {
    expect(() => parseJsonLdBlocks(html)).not.toThrow();
    const blocks = parseJsonLdBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("does not inject JSON-LD for unrelated paths", () => {
    const other = applyInjections(BASE_HTML, "/games");
    expect(other).not.toContain(`<script type="application/ld+json">`);
  });
});

// ---------------------------------------------------------------------------
// /linksshrink
// ---------------------------------------------------------------------------

describe("/linksshrink meta tag injection", () => {
  const path = "/linksshrink";
  let html: string;

  beforeEach(() => {
    html = applyInjections(BASE_HTML, path);
  });

  it("sets the correct <title>", () => {
    expect(html).toMatch(
      /<title>LinksShrink — Short Links, Video Ads &amp; Click Analytics<\/title>/,
    );
  });

  it("sets the correct canonical URL", () => {
    expect(html).toContain(
      `<link rel="canonical" href="https://ebookgamez.com/linksshrink" />`,
    );
  });

  it("sets og:url to https://ebookgamez.com/linksshrink", () => {
    expect(html).toContain(
      `<meta property="og:url" content="https://ebookgamez.com/linksshrink" />`,
    );
  });

  it("sets og:title to the LinksShrink page title", () => {
    expect(html).toContain(
      `<meta property="og:title" content="LinksShrink — Short Links, Video Ads &amp; Click Analytics" />`,
    );
  });

  it("sets og:description to the LinksShrink description", () => {
    expect(html).toContain(`<meta property="og:description" content="`);
    expect(html).toMatch(/og:description.*LinksShrink/s);
  });

  it("injects a <script type='application/ld+json'> block", () => {
    expect(html).toContain(`<script type="application/ld+json">`);
  });

  it("JSON-LD block has @type SoftwareApplication", () => {
    const blocks = parseJsonLdBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication");
    expect(app).toBeDefined();
  });

  it("SoftwareApplication block has name 'LinksShrink'", () => {
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.name).toBe("LinksShrink");
  });

  it("SoftwareApplication block has applicationCategory 'BusinessApplication'", () => {
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.applicationCategory).toBe("BusinessApplication");
  });

  it("SoftwareApplication block has a free Offer (price '0')", () => {
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.offers?.price).toBe("0");
  });

  it("JSON-LD block is valid JSON (does not throw on parse)", () => {
    expect(() => parseJsonLdBlocks(html)).not.toThrow();
    const blocks = parseJsonLdBlocks(html);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Trail-slash / query-string normalisation
// ---------------------------------------------------------------------------

describe("path normalisation for product app pages", () => {
  it("/learnforge/ (trailing slash) injects JSON-LD", () => {
    const html = applyInjections(BASE_HTML, "/learnforge/");
    expect(html).toContain(`<script type="application/ld+json">`);
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.name).toBe("LearnForge");
  });

  it("/learnforge?ref=nav (query string) injects JSON-LD", () => {
    const html = applyInjections(BASE_HTML, "/learnforge?ref=nav");
    expect(html).toContain(`<script type="application/ld+json">`);
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.name).toBe("LearnForge");
  });

  it("/linksshrink/ (trailing slash) injects JSON-LD", () => {
    const html = applyInjections(BASE_HTML, "/linksshrink/");
    expect(html).toContain(`<script type="application/ld+json">`);
    const blocks = parseJsonLdBlocks(html);
    const app = blocks.find((b: any) => b["@type"] === "SoftwareApplication") as any;
    expect(app?.name).toBe("LinksShrink");
  });
});
