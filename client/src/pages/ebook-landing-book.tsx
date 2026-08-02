import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  ShoppingCart,
  Star,
  Loader2,
  ChevronRight,
  User,
  Zap,
  Shield,
  Sparkles,
  Check,
  ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { optimizedSrc as optimizedCoverSrc } from "@/components/ui/book-card";

function buildCoverUrl(url: string | null | undefined): string {
  if (!url) return "/placeholder-book.jpg";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

export default function EbookLandingBook() {
  const [, params] = useRoute("/ebooks/b/:slug");
  const slug = params?.slug ?? "";

  const { data: book, isLoading, error } = useQuery<LandingBook>({
    queryKey: ["ebook-landing", slug],
    queryFn: async () => {
      const res = await fetch(`/api/books/by-slug/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error("Book not found");
      return res.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  // Client-side meta update (supplements server-injected tags post-hydration).
  useEffect(() => {
    if (!book) return;
    const desc = (book.description ?? "").slice(0, 160) || `Read "${book.title}" on EbookGamez.`;
    document.title = `${book.title} — EbookGamez`;

    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", `${book.title} — EbookGamez`);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", `https://ebookgamez.com/ebooks/b/${slug}`);
    if (book.coverUrl) {
      const cover = book.coverUrl.startsWith("http") ? book.coverUrl : `https://ebookgamez.com${book.coverUrl}`;
      setMeta('meta[property="og:image"]', "content", cover);
    }

    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
    };
  }, [book?.id]);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display text-white mb-2">Book Not Found</h1>
          <p className="text-muted-foreground mb-6">We couldn't find this ebook. Browse our full catalog below.</p>
          <Link href="/catalog">
            <Button className="bg-primary text-black hover:bg-primary/90 font-display">
              Browse Catalog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const price = parseFloat(book.price ?? "9.99");
  const rating = book.averageRating ?? parseFloat(book.rating ?? "4.5");
  const reviewCount = book.reviewCount ?? 0;
  const description = (book.description ?? "").trim();
  const bullets = extractBullets(description);
  const chapterCount = estimateChapters(description, book.title);

  const coverSrc = optimizedCoverSrc(book.coverUrl, 600);

  const BENEFITS = [
    { icon: <Zap className="h-4 w-4 text-primary" />, text: "Instant download — read anywhere, any device" },
    { icon: <Shield className="h-4 w-4 text-primary" />, text: "DRM-free — yours to keep forever" },
    { icon: <Sparkles className="h-4 w-4 text-primary" />, text: "Or read free with a Reading Pass subscription" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/ebooks" className="hover:text-white transition-colors">Ebooks</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/ebooks/${book.genre.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-white transition-colors">
            {book.genre}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white line-clamp-1">{book.title}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center"
          >
            <div className="relative w-full max-w-xs md:max-w-sm lg:max-w-md">
              <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10">
                <img
                  src={coverSrc}
                  alt={`${book.title} cover`}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
              {/* Price badge */}
              <div className="absolute top-3 right-3 bg-primary text-black font-display font-bold text-lg px-3 py-1 rounded-lg shadow-lg">
                ${price.toFixed(2)}
              </div>
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col gap-5"
          >
            {/* Genre badge */}
            <div>
              <Badge variant="outline" className="border-primary/50 text-primary text-xs uppercase tracking-wide">
                {book.genre}
              </Badge>
            </div>

            {/* Title + author */}
            <div>
              <h1 className="text-3xl lg:text-4xl font-display text-white leading-tight mb-2">
                {book.title}
              </h1>
              <p className="text-muted-foreground font-serif flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                by <span className="text-white ml-1">{book.author}</span>
              </p>
            </div>

            {/* Rating */}
            {(reviewCount > 0 || rating > 0) && (
              <div className="flex items-center gap-3">
                <StarDisplay rating={rating} size="lg" />
                <span className="text-amber-400 font-display text-lg">{rating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span className="text-muted-foreground text-sm">
                    ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" />
                ~{chapterCount} chapters
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                {book.category || "Digital"}
              </span>
            </div>

            {/* Description */}
            {description && (
              <p className="text-muted-foreground font-serif leading-relaxed text-sm lg:text-base line-clamp-4">
                {description}
              </p>
            )}

            <Separator className="border-white/10" />

            {/* Platform benefits */}
            <ul className="space-y-2">
              {BENEFITS.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  {b.icon}
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link href={`/book/${book.id}`}>
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 font-display text-base px-8"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Get This Book — ${price.toFixed(2)}
                </Button>
              </Link>
              <Link href="/subscription">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-white/20 text-white hover:bg-white/5 font-display text-base px-8"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Read Free with Pass
                </Button>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              Reading Pass from $4.99/mo · Unlimited books · Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefit bullets from description */}
      {bullets.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10">
          <Separator className="border-white/10 mb-10" />
          <h2 className="text-2xl font-display text-white mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What You'll Get
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bullets.map((bullet, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-start gap-3 bg-card/40 border border-white/8 rounded-lg p-4"
              >
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground font-serif text-sm leading-relaxed">{bullet}</span>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {/* Reading Pass upsell banner */}
      <section className="max-w-6xl mx-auto px-4 pb-14">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-display text-white mb-1">
              Unlimited Reading — One Low Price
            </h3>
            <p className="text-muted-foreground text-sm font-serif">
              Access <span className="text-white">600+ full-length ebooks</span> including this one with
              our Reading Pass. From ${" "}
              <span className="text-primary font-semibold">$4.99/month</span>.
            </p>
          </div>
          <Link href="/subscription">
            <Button className="bg-primary text-black hover:bg-primary/90 font-display whitespace-nowrap px-8">
              Start Reading Pass
            </Button>
          </Link>
        </div>
      </section>

      {/* Back link */}
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <Link href={`/book/${book.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          View full book details
        </Link>
      </div>
    </div>
  );
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface LandingBook {
  id: number;
  title: string;
  author: string;
  genre: string;
  category: string;
  price: string;
  rating: string;
  coverUrl: string;
  description?: string;
  reviewCount?: number;
  averageRating?: number;
  createdAt: string;
}

/** Estimate chapter / section count from description length as a rough proxy. */
function estimateChapters(description: string, title: string): number {
  const words = description.split(/\s+/).length;
  if (words < 50) return 8;
  if (words < 100) return 10;
  if (words < 200) return 12;
  return 15;
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const starSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${
            star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

/** Extract benefit bullets from a book description (up to 5). */
function extractBullets(description: string): string[] {
  // Split on sentence boundaries and take the first 5 non-trivial sentences.
  const raw = description
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 200);
  return raw.slice(0, 5);
}
