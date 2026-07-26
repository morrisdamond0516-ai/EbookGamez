import { useEffect } from "react";
import { Link, useSearch, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle2, Star, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";
import { trackEbooksCtaClick, trackEbooksGenreClick, trackScrollDepth, resetScrollDepthTracking } from "@/lib/analytics";

interface ApiBook {
  id: number;
  title: string;
  author: string;
  coverUrl: string;
  genre: string;
  price: string;
  rating: string;
  coverFit?: string;
}

const BENEFITS = [
  "600+ full-length ebooks across every genre",
  "Instant download — read on any device",
  "New titles added every week",
  "Individual purchases or unlimited Reading Pass",
  "DRM-free — yours to keep forever",
];

const GENRES = [
  "Romance", "Thriller", "Fantasy", "Sci-Fi",
  "Self-Help", "Mystery", "Horror", "Biography",
  "Business", "Classic Literature", "Adventure", "History",
];

function CoverGrid({ books }: { books: ApiBook[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {books.slice(0, 24).map((book, i) => (
        <motion.div
          key={book.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.35 }}
          className="aspect-[2/3] rounded-md overflow-hidden shadow-lg bg-white/5 border border-white/10"
        >
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-900/60 to-yellow-900/40 p-2">
              <span className="text-[9px] text-amber-300/70 text-center leading-tight font-serif">{book.title}</span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Map URL slug → display genre name
const SLUG_TO_GENRE: Record<string, string> = {
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

function genreToSlug(genre: string): string {
  return genre.toLowerCase().replace(/\s+/g, "-");
}

export default function EbooksLanding() {
  const { genre: genreSlug } = useParams<{ genre?: string }>();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  // Client-side redirect: /ebooks?genre=Romance → /ebooks/romance (for old links)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const legacyGenre = params.get("genre");
    if (legacyGenre && !genreSlug) {
      const slug = genreToSlug(legacyGenre);
      if (SLUG_TO_GENRE[slug]) {
        navigate(`/ebooks/${slug}`, { replace: true });
      }
    }
  }, [searchString, genreSlug, navigate]);

  // Determine active genre from path param (preferred) or query string fallback
  const activeGenre = genreSlug
    ? (SLUG_TO_GENRE[genreSlug.toLowerCase()] ?? "")
    : (() => {
        const params = new URLSearchParams(searchString);
        const qg = params.get("genre") ?? "";
        return GENRES.find(g => g.toLowerCase() === qg.toLowerCase()) ?? qg.trim();
      })();

  useEffect(() => {
    const title = activeGenre
      ? `${activeGenre} Ebooks — EbookGamez`
      : "Browse 600+ Ebooks — EbookGamez";
    document.title = title;
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prev = desc?.content ?? "";
    if (desc) {
      desc.content = activeGenre
        ? `Browse our full collection of ${activeGenre} ebooks. Instant download, DRM-free. Buy individually or unlock everything with a Reading Pass.`
        : "Discover 600+ full-length ebooks across romance, thriller, fantasy, self-help, and more. Instant download, DRM-free. Buy individually or unlock everything with a Reading Pass.";
    }
    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      if (desc) desc.content = prev;
    };
  }, [activeGenre]);

  useEffect(() => {
    resetScrollDepthTracking();
    const MILESTONES: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];

    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      for (const milestone of MILESTONES) {
        if (pct >= milestone) trackScrollDepth(milestone);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      resetScrollDepthTracking();
    };
  }, []);

  const { data, isLoading } = useQuery<{ books: ApiBook[] }>({
    queryKey: ["ebooks-landing-covers", activeGenre],
    queryFn: async () => {
      const url = activeGenre
        ? `/api/books?page=1&limit=24&genre=${encodeURIComponent(activeGenre)}`
        : "/api/books?page=1&limit=24";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const books = data?.books ?? [];

  // Derived copy and links that change when a genre is active
  const catalogHref = activeGenre
    ? `/catalog?search=${encodeURIComponent(activeGenre)}`
    : "/catalog";
  const heroHeadlineTop = activeGenre
    ? `Browse ${activeGenre} Ebooks`
    : "Your Next Favourite Book";
  const heroHeadlineBottom = activeGenre
    ? "Handpicked & DRM-Free"
    : "is Already Here";
  const heroBadge = activeGenre
    ? `600+ ${activeGenre} Ebooks · Instant Access`
    : "600+ Ebooks · Instant Access";
  const heroSubcopy = activeGenre
    ? `Discover our full collection of ${activeGenre} ebooks — DRM-free and yours the moment you buy. Browse individually or unlock everything with a Reading Pass.`
    : "Browse a handpicked library of 600+ full-length ebooks. Romance, thriller, fantasy, self-help, classics — all DRM-free and yours the moment you buy.";

  return (
    <div className="min-h-screen bg-background text-foreground font-body selection:bg-primary/30">
      {/* Minimal header — no nav, just brand */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="font-display text-lg text-primary tracking-wide cursor-pointer">
              EbookGamez
            </span>
          </Link>
          <Link href={catalogHref}>
            <Button
              size="sm"
              className="bg-primary text-black hover:bg-primary/90 font-serif font-semibold"
              onClick={() => trackEbooksCtaClick({ label: "Browse Library", destination: catalogHref, location: "header" })}
            >
              Browse Library
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 text-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5 mb-6">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-serif font-semibold tracking-wide uppercase">{heroBadge}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display text-white leading-tight mb-5">
            {heroHeadlineTop}<br />
            <span className="text-primary">{heroHeadlineBottom}</span>
          </h1>

          <p className="text-lg text-muted-foreground font-serif mb-8 max-w-xl mx-auto">
            {heroSubcopy}
          </p>

          <Link href={catalogHref}>
            <Button
              size="lg"
              className="bg-primary text-black hover:bg-primary/90 font-serif font-bold text-base px-8 py-6 rounded-lg shadow-lg shadow-primary/20 group"
              onClick={() => trackEbooksCtaClick({ label: "Browse the Library", destination: catalogHref, location: "hero" })}
            >
              Browse the Library
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground/60 mt-4 font-serif">
            No subscription required · Pay per book from $2.99
          </p>
        </motion.div>
      </section>

      {/* Cover Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <CoverGrid books={books} />
        )}
        <div className="text-center mt-8">
          <Link href={catalogHref}>
            <Button
              variant="outline"
              size="lg"
              className="border-primary/40 text-primary hover:bg-primary/10 font-serif px-8"
              onClick={() => trackEbooksCtaClick({ label: "See All 600+ Books", destination: catalogHref, location: "cover_grid" })}
            >
              {activeGenre ? `See All ${activeGenre} Books` : "See All 600+ Books"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Genre chips */}
      <section className="max-w-4xl mx-auto px-4 pb-14 text-center">
        <h2 className="text-xl font-display text-white/80 mb-5">Every genre covered</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {GENRES.map(g => (
            <Link key={g} href={`/catalog?search=${encodeURIComponent(g)}`}>
              <span
                className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-muted-foreground hover:text-white hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer font-serif"
                onClick={() => trackEbooksGenreClick({ genre: g, destination: `/catalog?search=${encodeURIComponent(g)}` })}
              >
                {g}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-2xl mx-auto px-4 pb-16">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-5 h-5 text-primary fill-primary" />
            <h2 className="font-display text-xl text-white">Why readers choose EbookGamez</h2>
          </div>
          <ul className="space-y-3">
            {BENEFITS.map(b => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground font-serif">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reading Pass upsell */}
      <section className="max-w-3xl mx-auto px-4 pb-20 text-center">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-10">
          <h2 className="text-2xl md:text-3xl font-display text-white mb-3">
            Want unlimited access?
          </h2>
          <p className="text-muted-foreground font-serif mb-6 max-w-md mx-auto">
            The Reading Pass unlocks every book in our library — read as many as you want for one low monthly price.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/subscription">
              <Button
                size="lg"
                className="bg-primary text-black hover:bg-primary/90 font-serif font-bold px-8"
                onClick={() => trackEbooksCtaClick({ label: "Get the Reading Pass", destination: "/subscription", location: "reading_pass_upsell" })}
              >
                Get the Reading Pass
              </Button>
            </Link>
            <Link href="/catalog">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 font-serif"
                onClick={() => trackEbooksCtaClick({ label: "Buy Individual Books", destination: "/catalog", location: "reading_pass_upsell" })}
              >
                Buy Individual Books
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
