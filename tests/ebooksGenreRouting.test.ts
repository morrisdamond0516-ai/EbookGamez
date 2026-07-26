/**
 * Smoke tests for /ebooks genre chip routing.
 *
 * Imports routing constants and helpers directly from the production source
 * (client/src/lib/ebookGenres.ts) so tests fail if that file is broken or
 * if a genre is added/renamed without updating the slug map.
 */

import { describe, expect, it } from "vitest";
import {
  GENRES,
  SLUG_TO_GENRE,
  genreToSlug,
  slugToGenre,
  genreChipHref,
} from "../client/src/lib/ebookGenres";

// ── Genre chip URL generation ────────────────────────────────────────────────

describe("Genre chip URL generation (production genreChipHref)", () => {
  it("produces a /ebooks/<slug> href for every genre", () => {
    for (const genre of GENRES) {
      const href = genreChipHref(genre);
      expect(href).toMatch(/^\/ebooks\/[a-z0-9-]+$/);
    }
  });

  it("Romance → /ebooks/romance", () => {
    expect(genreChipHref("Romance")).toBe("/ebooks/romance");
  });

  it("Thriller → /ebooks/thriller", () => {
    expect(genreChipHref("Thriller")).toBe("/ebooks/thriller");
  });

  it("Self-Help → /ebooks/self-help (hyphen preserved, no extra change)", () => {
    expect(genreChipHref("Self-Help")).toBe("/ebooks/self-help");
  });

  it("Classic Literature → /ebooks/classic-literature (space becomes hyphen)", () => {
    expect(genreChipHref("Classic Literature")).toBe("/ebooks/classic-literature");
  });

  it("Sci-Fi → /ebooks/sci-fi", () => {
    expect(genreChipHref("Sci-Fi")).toBe("/ebooks/sci-fi");
  });
});

// ── Slug → genre resolution ──────────────────────────────────────────────────

describe("Slug → genre resolution (production SLUG_TO_GENRE / slugToGenre)", () => {
  it("resolves every chip slug back to the original genre name (full round-trip)", () => {
    for (const genre of GENRES) {
      const href = genreChipHref(genre);
      const slug = href.replace("/ebooks/", "");
      expect(slugToGenre(slug)).toBe(genre);
    }
  });

  it("/ebooks/romance resolves to 'Romance'", () => {
    expect(slugToGenre("romance")).toBe("Romance");
  });

  it("/ebooks/thriller resolves to 'Thriller'", () => {
    expect(slugToGenre("thriller")).toBe("Thriller");
  });

  it("/ebooks/self-help resolves to 'Self-Help'", () => {
    expect(slugToGenre("self-help")).toBe("Self-Help");
  });

  it("/ebooks/classic-literature resolves to 'Classic Literature'", () => {
    expect(slugToGenre("classic-literature")).toBe("Classic Literature");
  });

  it("unknown slug returns undefined (no silent fallback)", () => {
    expect(slugToGenre("unknown-genre")).toBeUndefined();
  });
});

// ── SLUG_TO_GENRE completeness ───────────────────────────────────────────────

describe("SLUG_TO_GENRE completeness (production constant)", () => {
  it("every genre in GENRES has a corresponding entry in SLUG_TO_GENRE", () => {
    for (const genre of GENRES) {
      const slug = genreToSlug(genre);
      expect(SLUG_TO_GENRE).toHaveProperty(slug, genre);
    }
  });

  it("SLUG_TO_GENRE has no extra entries not in GENRES (no orphaned slugs)", () => {
    const slugsFromGenres = new Set(GENRES.map(genreToSlug));
    for (const slug of Object.keys(SLUG_TO_GENRE)) {
      expect(slugsFromGenres.has(slug)).toBe(true);
    }
  });
});

// ── genreToSlug helper ───────────────────────────────────────────────────────

describe("genreToSlug helper (production function)", () => {
  it("lowercases the genre", () => {
    expect(genreToSlug("Romance")).toBe("romance");
  });

  it("replaces spaces with hyphens", () => {
    expect(genreToSlug("Classic Literature")).toBe("classic-literature");
  });

  it("collapses multiple consecutive spaces into a single hyphen", () => {
    expect(genreToSlug("Classic  Literature")).toBe("classic-literature");
  });

  it("preserves existing hyphens in Sci-Fi", () => {
    expect(genreToSlug("Sci-Fi")).toBe("sci-fi");
  });

  it("preserves existing hyphens in Self-Help", () => {
    expect(genreToSlug("Self-Help")).toBe("self-help");
  });
});
