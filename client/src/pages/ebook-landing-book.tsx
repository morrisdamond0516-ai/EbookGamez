import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ShoppingCart, Star, CheckCircle, ArrowRight, Loader2 } from "lucide-react";

interface BookData {
  id: number;
  title: string;
  description: string | null;
  price: string;
  genre: string | null;
  author: string | null;
  coverUrl: string | null;
}

function buildCoverUrl(url: string | null | undefined): string {
  if (!url) return "/placeholder-book.jpg";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

export default function EbookLandingBook() {
  const [, params] = useRoute("/ebooks/b/:slug");
  const slug = params?.slug ?? "";

  const [book, setBook] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState<"no" | "added" | "exists">("no");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    fetch(`/api/books/by-slug/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setBook(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug]);

  function handleAddToCart() {
    if (!book) return;
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    if (cart.find((item: any) => item.id === book.id)) {
      setAdded("exists");
      return;
    }
    cart.push({ id: book.id, title: book.title, price: book.price, coverUrl: book.coverUrl });
    localStorage.setItem("cart", JSON.stringify(cart));
    setAdded("added");
    setTimeout(() => setAdded("no"), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-white/50 font-serif text-lg">Book not found.</p>
          <Link href="/catalog">
            <Button variant="outline">Browse Catalog</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const price = parseFloat(book.price ?? "0");
  const coverUrl = buildCoverUrl(book.coverUrl);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Hero section */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-10 items-start">

            {/* Cover */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="w-52 md:w-64 shadow-2xl shadow-black/60 rounded-lg overflow-hidden border border-white/10">
                <img
                  src={coverUrl}
                  alt={`Cover of ${book.title}`}
                  className="w-full h-auto object-cover"
                  loading="eager"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder-book.jpg";
                  }}
                />
              </div>
              {book.genre && (
                <Badge className="mt-3 mx-auto block w-fit bg-primary/20 text-primary border-primary/30 font-serif">
                  {book.genre}
                </Badge>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs tracking-[0.25em] text-primary/60 uppercase font-serif mb-2">
                Full-Length Ebook · DRM-Free
              </p>
              <h1 className="font-display text-3xl md:text-4xl text-white font-bold leading-tight mb-3">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-white/50 font-serif mb-6">by {book.author}</p>
              )}

              {/* Quick stats */}
              <div className="flex flex-wrap gap-4 mb-6 text-sm text-white/40 font-serif">
                <span>✅ Instant download</span>
                <span>📱 Read on any device</span>
                <span>🔓 DRM-free</span>
              </div>

              {book.description && (
                <p className="text-white/65 font-serif leading-relaxed mb-8 max-w-2xl">
                  {book.description.length > 600
                    ? book.description.slice(0, 600) + "…"
                    : book.description}
                </p>
              )}

              {/* Price + CTA */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <span className="text-3xl font-display text-white font-bold">
                  {price === 0 ? "Free" : `$${price.toFixed(2)}`}
                </span>
                <Button
                  size="lg"
                  onClick={handleAddToCart}
                  className="bg-primary text-black font-semibold px-8 hover:bg-primary/90 transition-all"
                >
                  {added === "added" ? (
                    <>Added <CheckCircle className="ml-2 h-5 w-5" /></>
                  ) : added === "exists" ? (
                    <>Already in Cart</>
                  ) : (
                    <><ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart</>
                  )}
                </Button>
                <Link href={`/book/${book.id}`}>
                  <Button variant="outline" className="border-white/20 text-white/70 hover:text-white">
                    <BookOpen className="mr-2 h-4 w-4" /> View Details
                  </Button>
                </Link>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap gap-6 text-sm text-white/40 font-serif">
                <span>🔒 Secure checkout</span>
                <span>📦 DRM-free — yours forever</span>
                <span>💳 30-day money-back guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-16 px-4 bg-black/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl text-white text-center mb-10">What You Get</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: "📖", title: "Full-Length Book", desc: "Complete, unabridged text — not a summary or extract." },
              { icon: "📲", title: "Multi-Device Access", desc: "Read on phone, tablet, or desktop. Your purchase is tied to your account." },
              { icon: "🔓", title: "DRM-Free", desc: "No restrictions. Download it once and keep it forever." },
              { icon: "⚡", title: "Instant Delivery", desc: "Available immediately after checkout — no waiting, no shipping." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-black/30 border border-white/10 rounded-lg p-5 hover:border-primary/20 transition-colors">
                <div className="text-2xl mb-2">{icon}</div>
                <h3 className="font-serif text-white font-semibold mb-1">{title}</h3>
                <p className="text-white/50 text-sm font-serif">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reading Pass upsell */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-primary/60 font-serif text-sm mb-2">Better value for avid readers</p>
          <h3 className="font-display text-2xl text-white mb-3">Unlock 600+ Books with Reading Pass</h3>
          <p className="text-white/50 font-serif mb-6">
            Reading Pass gives you unlimited access to our entire library for one monthly price.
            If you read more than one or two books a month, it pays for itself immediately.
          </p>
          <Link href="/subscription">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8">
              View Reading Pass Plans <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
