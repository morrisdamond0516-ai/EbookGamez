/**
 * Utilities for the /api/content-studio/title-mismatches endpoint.
 * Extracted so they can be unit-tested independently of the Express layer.
 */

/**
 * Extract the first H1 heading from content.
 * Handles:
 *   - Markdown:  # Some Title
 *   - HTML:      <h1>Some Title</h1>  or  <h1 class="...">Some Title</h1>
 */
export function extractFirstH1(content: string): string | null {
  // Try markdown-style first: line starting with exactly one # then a space
  const mdMatch = content.match(/^#{1}\s+(.+?)(?:\s+#+)?$/m);
  if (mdMatch) return mdMatch[1].trim();

  // Try HTML-style: <h1 ...>...</h1>  (single-line, case-insensitive)
  const htmlMatch = content.match(/<h1(?:\s[^>]*)?>([^<]+)<\/h1>/i);
  if (htmlMatch) return htmlMatch[1].trim();

  return null;
}

/**
 * Normalize a title string for comparison:
 * lowercase, collapse internal whitespace, trim edges.
 */
export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Return true when the stored title and the H1 in the content differ
 * (after normalization).
 */
export function isTitleMismatch(storedTitle: string, h1: string): boolean {
  return normalizeTitle(storedTitle) !== normalizeTitle(h1);
}
