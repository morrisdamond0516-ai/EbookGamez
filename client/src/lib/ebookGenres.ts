/**
 * Genre routing helpers shared between ebooks.tsx and the test suite.
 * Single source of truth for the GENRES list, slug↔genre mapping, and helpers.
 */

export const GENRES = [
  "Romance",
  "Thriller",
  "Fantasy",
  "Sci-Fi",
  "Self-Help",
  "Mystery",
  "Horror",
  "Biography",
  "Business",
  "Classic Literature",
  "Adventure",
  "History",
] as const;

export type Genre = (typeof GENRES)[number];

/** URL slug → display genre name */
export const SLUG_TO_GENRE: Record<string, string> = {
  "romance": "Romance",
  "thriller": "Thriller",
  "fantasy": "Fantasy",
  "sci-fi": "Sci-Fi",
  "self-help": "Self-Help",
  "mystery": "Mystery",
  "horror": "Horror",
  "biography": "Biography",
  "business": "Business",
  "classic-literature": "Classic Literature",
  "adventure": "Adventure",
  "history": "History",
};

/** Convert a display genre name to its URL slug. */
export function genreToSlug(genre: string): string {
  return genre.toLowerCase().replace(/\s+/g, "-");
}

/** Resolve a URL slug back to its display genre name (undefined if unknown). */
export function slugToGenre(slug: string): string | undefined {
  return SLUG_TO_GENRE[slug.toLowerCase()];
}

/** The href used by genre chip <Link> elements. */
export function genreChipHref(genre: string): string {
  return `/ebooks/${genreToSlug(genre)}`;
}
