/**
 * Smoke tests for genre share-card Open Graph tags.
 *
 * Imports injectCanonical and injectOpenGraph directly from server/seoUtils.ts
 * so any regression in the injection logic or genre meta copy will fail here
 * before reaching production.
 *
 * Covered paths:
 *  /ebooks/romance  — genre page
 *  /ebooks/thriller — genre page
 *  /ebooks          — hub page
 *  /                — homepage (default tags must be untouched)
 */

import { describe, expect, it } from "vitest";
import { injectCanonical, injectOpenGraph } from "../server/seoUtils";

// ---------------------------------------------------------------------------
// Minimal HTML template that mirrors the real client/index.html meta tags.
// Regex patterns in seoUtils match these exact attribute formats.
// ---------------------------------------------------------------------------
const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="canonical" href="https://ebookgamez.com/" />
    <meta property="og:title" content="EbookGamez - Ebooks, Games, Downloads &amp; Gaming Guides" />
    <meta property="og:description" content="Browse 600+ full-length ebooks, play free HTML5 games, download top PC &amp; console titles, and read expert gaming guides — all in one place." />
    <meta property="og:url" content="https://ebookgamez.com/" />
    <meta property="og:type" content="website" />
    <meta name="twitter:title" content="EbookGamez - Ebooks, Games, Downloads &amp; Gaming Guides" />
    <meta name="twitter:description" content="EbookGamez is a digital entertainment platform offering 545+ full-length ebooks." />
  </head>
  <body><div id="root"></div></body>
</html>`;

/** Run both injection helpers on the template for a given path. */
function processPath(urlPath: string): string {
  const withCanonical = injectCanonical(TEMPLATE, urlPath);
  return injectOpenGraph(withCanonical, urlPath);
}

/** Extract content="..." from a meta tag matched by the given property/name. */
function getMetaContent(html: string, attr: string, value: string): string | null {
  const re = new RegExp(`<meta\\s+(?:property|name)="${attr}"\\s+content="([^"]*)"`, "i");
  // Also match reversed attribute order
  const re2 = new RegExp(`<meta\\s+content="([^"]*)"\\s+(?:property|name)="${attr}"`, "i");
  const m = re.exec(html) ?? re2.exec(html);
  return m ? m[1] : null;
}

/** Extract href from <link rel="canonical"> */
function getCanonical(html: string): string | null {
  const m = /<link rel="canonical" href="([^"]*)"/.exec(html);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// /ebooks/romance
// ---------------------------------------------------------------------------

describe("/ebooks/romance — Open Graph share card", () => {
  const html = processPath("/ebooks/romance");

  it("og:url points to the romance genre page", () => {
    expect(getMetaContent(html, "og:url", "")).toBe("https://ebookgamez.com/ebooks/romance");
  });

  it("og:title is romance-specific (not the homepage default)", () => {
    const title = getMetaContent(html, "og:title", "");
    expect(title).not.toBeNull();
    expect(title!.toLowerCase()).toContain("romance");
    expect(title!.toLowerCase()).not.toContain("games, downloads");
  });

  it("og:description is romance-specific", () => {
    const desc = getMetaContent(html, "og:description", "");
    expect(desc).not.toBeNull();
    expect(desc!.toLowerCase()).toContain("romance");
  });

  it("twitter:title is romance-specific", () => {
    const title = getMetaContent(html, "twitter:title", "");
    expect(title).not.toBeNull();
    expect(title!.toLowerCase()).toContain("romance");
  });

  it("twitter:description is romance-specific", () => {
    const desc = getMetaContent(html, "twitter:description", "");
    expect(desc).not.toBeNull();
    expect(desc!.toLowerCase()).toContain("romance");
  });

  it("canonical href points to the romance page", () => {
    expect(getCanonical(html)).toBe("https://ebookgamez.com/ebooks/romance");
  });
});

// ---------------------------------------------------------------------------
// /ebooks/thriller
// ---------------------------------------------------------------------------

describe("/ebooks/thriller — Open Graph share card", () => {
  const html = processPath("/ebooks/thriller");

  it("og:url points to the thriller genre page", () => {
    expect(getMetaContent(html, "og:url", "")).toBe("https://ebookgamez.com/ebooks/thriller");
  });

  it("og:title is thriller-specific", () => {
    const title = getMetaContent(html, "og:title", "");
    expect(title).not.toBeNull();
    expect(title!.toLowerCase()).toContain("thriller");
    expect(title!.toLowerCase()).not.toContain("games, downloads");
  });

  it("og:description is thriller-specific", () => {
    const desc = getMetaContent(html, "og:description", "");
    expect(desc).not.toBeNull();
    expect(desc!.toLowerCase()).toContain("thriller");
  });

  it("twitter:title is thriller-specific", () => {
    const title = getMetaContent(html, "twitter:title", "");
    expect(title).not.toBeNull();
    expect(title!.toLowerCase()).toContain("thriller");
  });

  it("twitter:description is thriller-specific", () => {
    const desc = getMetaContent(html, "twitter:description", "");
    expect(desc).not.toBeNull();
    expect(desc!.toLowerCase()).toContain("thriller");
  });

  it("canonical href points to the thriller page", () => {
    expect(getCanonical(html)).toBe("https://ebookgamez.com/ebooks/thriller");
  });
});

// ---------------------------------------------------------------------------
// /ebooks  (hub page)
// ---------------------------------------------------------------------------

describe("/ebooks — hub page Open Graph share card", () => {
  const html = processPath("/ebooks");

  it("og:url points to /ebooks", () => {
    expect(getMetaContent(html, "og:url", "")).toBe("https://ebookgamez.com/ebooks");
  });

  it("og:title mentions ebooks and is distinct from homepage default", () => {
    const title = getMetaContent(html, "og:title", "");
    expect(title).not.toBeNull();
    expect(title!.toLowerCase()).toContain("ebook");
    expect(title!).not.toBe("EbookGamez - Ebooks, Games, Downloads &amp; Gaming Guides");
  });

  it("og:description is specific to the /ebooks hub", () => {
    const desc = getMetaContent(html, "og:description", "");
    expect(desc).not.toBeNull();
    // The hub description references genre variety or the reading pass.
    expect(desc!.toLowerCase()).toMatch(/ebook|reading pass|subscribe/);
    // Must differ from the homepage fallback.
    expect(desc!).not.toBe(
      "Browse 600+ full-length ebooks, play free HTML5 games, download top PC &amp; console titles, and read expert gaming guides — all in one place.",
    );
  });

  it("canonical href points to /ebooks", () => {
    expect(getCanonical(html)).toBe("https://ebookgamez.com/ebooks");
  });
});

// ---------------------------------------------------------------------------
// / (homepage) — default tags must remain untouched
// ---------------------------------------------------------------------------

describe("/ (homepage) — default generic tags are preserved", () => {
  const html = processPath("/");

  it("og:url is unchanged (homepage default)", () => {
    // injectOpenGraph only rewrites known genre/ebook paths; / is left alone.
    // The canonical injector also leaves / unchanged since there is no specific rule.
    const url = getMetaContent(html, "og:url", "");
    expect(url).toBe("https://ebookgamez.com/");
  });

  it("og:title is the generic homepage title", () => {
    const title = getMetaContent(html, "og:title", "");
    expect(title).not.toBeNull();
    // Should still contain the default text — not a genre override.
    expect(title!).toContain("EbookGamez");
    expect(title!.toLowerCase()).not.toMatch(/^romance|^thriller|^fantasy/);
  });

  it("og:description is the generic homepage description", () => {
    const desc = getMetaContent(html, "og:description", "");
    expect(desc).not.toBeNull();
    // Should not have been replaced with a genre-specific copy.
    expect(desc!.toLowerCase()).not.toMatch(/^fall in love|^keep the pages/);
  });
});

// ---------------------------------------------------------------------------
// Unknown / invalid genre slug — must not inject genre-specific tags
// ---------------------------------------------------------------------------

describe("/ebooks/unknown-genre — no OG injection for invalid slugs", () => {
  const html = processPath("/ebooks/unknown-genre");

  it("og:url is left at template default (not injected)", () => {
    const url = getMetaContent(html, "og:url", "");
    expect(url).toBe("https://ebookgamez.com/");
  });

  it("og:title is left at template default", () => {
    const title = getMetaContent(html, "og:title", "");
    expect(title).not.toBeNull();
    expect(title!).toContain("EbookGamez");
  });
});
