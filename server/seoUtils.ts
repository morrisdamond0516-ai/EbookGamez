/**
 * Server-side SEO helpers — inject the correct canonical URL into the HTML
 * shell before it is sent to the browser (or Googlebot).
 *
 * This ensures crawlers see the right canonical in the initial response
 * without waiting for React to hydrate and run its useEffect.
 */

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

/**
 * Replace the static `<link rel="canonical">` tag in `html` with the correct
 * URL for the given request path.
 *
 * Rules:
 *  - /ebooks              → https://ebookgamez.com/ebooks
 *  - /ebooks/<valid-slug> → https://ebookgamez.com/ebooks/<slug>
 *  - everything else      → leave the existing canonical unchanged
 */
export function injectCanonical(html: string, urlPath: string): string {
  // Strip query-string / hash so we match paths cleanly
  const cleanPath = urlPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

  let canonical: string | null = null;

  if (cleanPath === "/ebooks") {
    canonical = `${BASE_URL}/ebooks`;
  } else {
    const m = cleanPath.match(/^\/ebooks\/([^/]+)$/);
    if (m) {
      const slug = m[1].toLowerCase();
      if (VALID_GENRE_SLUGS.has(slug)) {
        canonical = `${BASE_URL}/ebooks/${slug}`;
      }
    }
  }

  if (!canonical) return html;

  return html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonical}" />`,
  );
}
