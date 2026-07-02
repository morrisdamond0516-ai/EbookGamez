import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Download, BookOpen, ShoppingBag, ArrowRight, Sparkles, ExternalLink, X } from "lucide-react";
import { trackAddToCart } from "@/lib/analytics";
const heroBg = "/hero.webp";

interface Book {
  id: number;
  title: string;
  author: string;
  price: string;
  rating: string;
  coverUrl: string;
  genre: string;
  description?: string;
  subscriberExclusiveUntil?: string | null;
}

export default function Home() {
  const [showAll, setShowAll] = useState(false);
  const [popup, setPopup] = useState<"none" | "catalog">("none");
  const [popupDismissCount, setPopupDismissCount] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: newBooks = [] } = useQuery<Book[]>({
    queryKey: ["/api/books/newest"],
    queryFn: async () => {
      const res = await fetch("/api/books?page=1&limit=12");
      if (!res.ok) throw new Error("Failed to fetch books");
      const data = await res.json();
      return data.books || data;
    },
  });

  const featuredBooks = showAll ? newBooks : newBooks.slice(0, 6);

  const handleExitIntent = useCallback((e: MouseEvent) => {
    if (e.clientY <= 5) {
      const dismissed = sessionStorage.getItem("ebgz_popup_dismissed") || "0";
      if (parseInt(dismissed) === 0) {
        setPopup("catalog");
        setPopupDismissCount(1);
        sessionStorage.setItem("ebgz_popup_dismissed", "1");
      }
    }
  }, []);

  useEffect(() => {
    const dismissed = parseInt(sessionStorage.getItem("ebgz_popup_dismissed") || "0");
    if (dismissed < 1) {
      document.addEventListener("mouseleave", handleExitIntent);
      return () => document.removeEventListener("mouseleave", handleExitIntent);
    }
  }, [handleExitIntent, popupDismissCount]);

  const handlePopupAction = (destination: string) => {
    setPopup("none");
    setLocation(destination);
  };

  const handlePopupClose = () => {
    setPopup("none");
  };

  const handleAddToCart = (book: Book) => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    if (cart.find((item: any) => item.id === book.id)) {
      toast({ title: "Already in cart", description: `${book.title} is already in your cart.` });
      return;
    }
    cart.push({
      id: book.id,
      title: book.title,
      author: book.author,
      price: parseFloat(book.price),
      coverUrl: book.coverUrl,
    });
    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));
    trackAddToCart({ id: book.id, title: book.title, price: parseFloat(book.price) });
    toast({ title: "Added to cart", description: `${book.title} has been added to your cart.` });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body selection:bg-primary/30">
      <Navbar />

      <AnimatePresence>
        {popup !== "none" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={handlePopupClose}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative bg-card border border-primary/30 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl shadow-primary/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handlePopupClose}
                className="absolute top-3 right-3 text-muted-foreground hover:text-white transition-colors"
                data-testid="button-close-popup"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>

              {!feedbackSubmitted ? (
                <>
                  {/* ── Step 1: Ask for feedback ── */}
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-display text-white mb-2">Help Us Improve!</h3>
                  <p className="text-muted-foreground font-serif mb-5 text-sm leading-relaxed">
                    Before you go — what could we do better? Share your honest thoughts and we'll 
                    <span className="text-primary font-semibold"> reward you with 10% off</span> your first order as a thank you.
                  </p>
                  <div className="text-left mb-4">
                    <label className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-2 block">What should we change or improve?</label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Tell us what you found wrong, what's missing, or what you'd love to see…"
                      rows={4}
                      className="w-full bg-black/30 border border-primary/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary/60 transition-colors"
                      data-testid="input-exit-feedback"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!feedbackText.trim()) return;
                      try {
                        await fetch("/api/feedback", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ message: feedbackText.trim(), source: "exit-popup" }),
                        });
                      } catch {}
                      setFeedbackSubmitted(true);
                      setFeedbackText("");
                    }}
                    disabled={!feedbackText.trim()}
                    className="w-full bg-primary text-black hover:bg-primary/90 font-display text-lg py-6 mb-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="button-submit-feedback"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Send Feedback & Claim 10% Off
                  </Button>
                  <button
                    onClick={handlePopupClose}
                    className="text-xs text-muted-foreground/60 hover:text-white transition-colors"
                  >
                    No thanks, I'll leave without my discount
                  </button>
                </>
              ) : (
                <>
                  {/* ── Step 2: Reveal the reward ── */}
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-display text-white mb-2">Thank You! 🙏</h3>
                  <p className="text-muted-foreground font-serif mb-5 text-sm">
                    We truly appreciate your feedback — it helps us build a better experience for everyone. 
                    Here's your exclusive discount code:
                  </p>
                  <div className="bg-black/30 border-2 border-primary/50 rounded-xl px-4 py-4 mb-5 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Your exclusive code</p>
                    <span className="text-primary font-display text-3xl tracking-widest font-bold">WELCOME10</span>
                    <p className="text-xs text-muted-foreground mt-1">10% off your entire first order</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("WELCOME10");
                        localStorage.setItem("ebgz_promo", "WELCOME10");
                      }}
                      className="mt-2 text-xs text-primary/70 hover:text-primary underline transition-colors"
                    >
                      Click to copy code
                    </button>
                  </div>
                  <Button
                    onClick={() => {
                      localStorage.setItem("ebgz_promo", "WELCOME10");
                      handlePopupAction("/catalog");
                    }}
                    className="w-full bg-primary text-black hover:bg-primary/90 font-display text-lg py-6 mb-3"
                    data-testid="button-popup-catalog"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Browse & Save 10%
                  </Button>
                  <button
                    onClick={handlePopupClose}
                    className="text-xs text-muted-foreground/60 hover:text-white transition-colors"
                  >
                    Maybe later
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Library Background"
            className="w-full h-full object-cover opacity-60 brightness-[0.85]"
            fetchPriority="high"
            decoding="sync"
          />
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="text-primary font-serif italic text-xl md:text-2xl mb-4 tracking-wider">Welcome to</h2>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-display text-white mb-6 drop-shadow-2xl tracking-tighter">
              EBOOK<span className="text-primary">GAME</span><span className="italic text-white" style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 0 12px rgba(201, 169, 113, 0.6)' }}>Z</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto font-serif leading-relaxed mb-10">
              Where the greatest stories of <span className="text-primary border-b border-primary/30">Cinema</span> and <span className="text-primary border-b border-primary/30">Literature</span> converge.
            </p>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link href="/catalog">
                <Button size="lg" className="bg-primary text-black hover:bg-primary/90 px-8 font-display rounded-sm flex flex-col items-center leading-tight h-auto py-3 min-w-[200px]" data-testid="button-explore-collection">
                  <span className="text-xl font-bold tracking-wide">Explore Collection</span>
                  <span className="text-[11px] font-sans font-semibold tracking-wider uppercase opacity-75 mt-0.5">📚 600+ Full-Length Ebooks</span>
                </Button>
              </Link>
              <Link href="/games">
                <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10 text-lg px-8 py-6 font-display rounded-sm backdrop-blur-sm" data-testid="button-play-games">
                  Play Free Games
                </Button>
              </Link>
              <a href="https://linksshrink.com" target="_blank" rel="noopener noreferrer" data-testid="button-video-ads">
                <Button size="lg" className="bg-primary text-black hover:bg-primary/90 px-8 font-display rounded-sm flex flex-col items-center leading-tight h-auto py-3 min-w-[200px]">
                  <span className="text-xl font-bold tracking-wide">LinksShrink</span>
                  <span className="text-[11px] font-sans font-semibold tracking-wider uppercase opacity-75 mt-0.5">🎬 New — Create Video Ads</span>
                </Button>
              </a>
            </div>

            {/* ── LearnForge: AI Learning & Career Tool ── */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.55 }}
              className="mt-10 flex justify-center"
            >
              <a
                href="https://knowledge-builder.replit.app/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-learnforge"
                className="group relative inline-flex flex-col items-center justify-center gap-1 px-16 py-6 font-display tracking-wide transition-all duration-300 hover:scale-[1.025]"
                style={{
                  borderRadius: '75px 75px 55px 55px / 55px 55px 75px 75px',
                  background: 'radial-gradient(ellipse at center, rgba(201,169,113,0.13) 0%, rgba(60,35,5,0.42) 55%, rgba(8,4,1,0.68) 100%)',
                  border: '1.5px solid rgba(201,169,113,0.48)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {/* pulsing ambient gold glow — blends with fireplace atmosphere */}
                <motion.span
                  className="pointer-events-none absolute inset-[-4px]"
                  animate={{ opacity: [0.3, 0.75, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    borderRadius: 'inherit',
                    boxShadow: '0 0 40px rgba(201,169,113,0.28), 0 0 80px rgba(139,90,20,0.12)',
                  }}
                />

                {/* shimmer sweep on hover */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-primary/10 to-transparent skew-x-12" style={{ borderRadius: 'inherit' }} />

                {/* floating graduation caps */}
                <span className="pointer-events-none absolute -top-5 left-8 text-3xl select-none"
                  style={{ transform: 'rotate(-16deg)', filter: 'drop-shadow(0 2px 8px rgba(201,169,113,0.8))' }}>🎓</span>
                <span className="pointer-events-none absolute -top-5 right-8 text-3xl select-none"
                  style={{ transform: 'rotate(16deg)', filter: 'drop-shadow(0 2px 8px rgba(201,169,113,0.8))' }}>🎓</span>

                {/* eyebrow label */}
                <span className="text-[9px] font-bold tracking-[0.28em] uppercase mb-0.5"
                  style={{ color: 'rgba(201,169,113,0.6)' }}>✦ Free AI Learning &amp; Career Tool ✦</span>

                {/* main name */}
                <span className="text-2xl md:text-3xl font-display tracking-widest"
                  style={{ color: '#f5e8c8', textShadow: '0 0 22px rgba(201,169,113,0.65), 0 2px 8px rgba(0,0,0,0.8)' }}>
                  LearnForge
                </span>

                {/* tagline */}
                <span className="text-[11px] font-serif tracking-wider mt-0.5"
                  style={{ color: 'rgba(201,169,113,0.5)' }}>
                  Forge Skills · Ace Exams · Advance Your Career
                </span>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 container mx-auto px-4 relative z-10">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-display text-white mb-4">Your Complete Gaming, Reading & Learning Hub</h2>
          <p className="text-muted-foreground font-serif max-w-xl mx-auto text-lg">Everything you need — play, download, study, and read — all in one place.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Gamepad2,
              title: "Play Games",
              subtitle: "Instant Browser Games",
              desc: "Jump into 40+ free HTML5 games — action, racing, sports, puzzles — no downloads needed. New titles added regularly.",
              href: "/games",
              gradient: "from-blue-600 via-blue-800 to-indigo-950",
              glow: "shadow-blue-500/20",
              accent: "text-blue-400",
              accentBg: "bg-blue-500/10",
              borderHover: "hover:border-blue-400/50",
              emoji: "🎮",
              stat: "40+ Games",
              external: false,
            },
            {
              icon: Download,
              title: "Download Hub",
              subtitle: "Safe & Official Links",
              desc: "Get Fortnite, Roblox, Minecraft, Valorant, GTA, and every major game. Every link verified and direct from official sources.",
              href: "/downloads",
              gradient: "from-emerald-600 via-emerald-800 to-teal-950",
              glow: "shadow-emerald-500/20",
              accent: "text-emerald-400",
              accentBg: "bg-emerald-500/10",
              borderHover: "hover:border-emerald-400/50",
              emoji: "⬇️",
              stat: "50+ Titles",
              external: false,
            },
            {
              icon: BookOpen,
              title: "Gaming Guides",
              subtitle: "Pro Tips & Strategies",
              desc: "Master your favorite games with pro settings, tier lists, build guides, and strategies that actually work. Written by real gamers.",
              href: "/guides",
              gradient: "from-violet-600 via-purple-800 to-indigo-950",
              glow: "shadow-violet-500/20",
              accent: "text-violet-400",
              accentBg: "bg-violet-500/10",
              borderHover: "hover:border-violet-400/50",
              emoji: "📖",
              stat: "Expert Guides",
              external: false,
            },
            {
              icon: ShoppingBag,
              title: "Ebook Store",
              subtitle: "600+ Digital Books",
              desc: "Thrillers, fantasy, romance, sci-fi, horror, classics, self-help and more. AI-crafted originals plus timeless public domain masterpieces.",
              href: "/catalog",
              gradient: "from-amber-600 via-amber-800 to-yellow-950",
              glow: "shadow-amber-500/20",
              accent: "text-amber-400",
              accentBg: "bg-amber-500/10",
              borderHover: "hover:border-amber-400/50",
              emoji: "📚",
              stat: "From $0.99",
              external: false,
            },
          ].map((section, i) => (
            <Link key={section.title} href={section.href}>
              <motion.div
                data-testid={`card-section-${section.title.toLowerCase().replace(/\s/g, "-")}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className={`relative overflow-hidden rounded-2xl border border-white/10 ${section.borderHover} transition-all duration-500 group cursor-pointer shadow-xl ${section.glow} hover:shadow-2xl`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-40`} />
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/[0.03] -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/[0.02] translate-y-1/2 -translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />

                <div className="relative z-10 p-8">
                  <div className="flex items-start justify-between mb-5">
                    <div className={`${section.accentBg} rounded-xl p-3 border border-white/5`}>
                      <section.icon className={`h-8 w-8 ${section.accent} group-hover:scale-110 transition-transform`} />
                    </div>
                    <span className="text-3xl opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all duration-300">{section.emoji}</span>
                  </div>

                  <h3 className="font-display text-2xl text-white mb-1 group-hover:text-primary transition-colors">{section.title}</h3>
                  <p className={`text-xs uppercase tracking-[0.15em] ${section.accent} font-display mb-3`}>{section.subtitle}</p>
                  <p className="text-white/50 text-sm font-serif leading-relaxed mb-6">{section.desc}</p>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-display uppercase tracking-wider ${section.accent} ${section.accentBg} px-3 py-1.5 rounded-full border border-white/5`}>
                      {section.stat}
                    </span>
                    <span className={`${section.accent} text-sm font-serif flex items-center gap-1 group-hover:gap-3 transition-all duration-300`}>
                      Explore <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}

          {/* LearnForge — full-width featured card */}
          <motion.a
            href="https://knowledge-builder.replit.app/"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="card-section-learnforge"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            whileHover={{ y: -6, scale: 1.01 }}
            className="sm:col-span-2 relative overflow-hidden rounded-2xl border border-primary/25 hover:border-primary/55 transition-all duration-500 group cursor-pointer shadow-xl shadow-amber-900/20 hover:shadow-amber-700/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/50 via-stone-950 to-yellow-950/40 opacity-90" />
            <div className="absolute inset-0 bg-black/40" />
            {/* decorative orbs */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/[0.06] -translate-y-1/3 translate-x-1/3 group-hover:scale-125 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-amber-700/[0.07] translate-y-1/3 -translate-x-1/3 group-hover:scale-125 transition-transform duration-700" />

            <div className="relative z-10 p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                {/* left: info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-primary/10 rounded-xl p-3 border border-primary/15">
                      <Sparkles className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-4xl opacity-70 group-hover:opacity-100 group-hover:scale-125 transition-all duration-300">🎓</span>
                    <span className="text-xs font-display uppercase tracking-[0.2em] text-primary/60 border border-primary/20 px-3 py-1 rounded-full">Free · AI-Powered</span>
                  </div>

                  <h3 className="font-display text-3xl text-white mb-1 group-hover:text-primary transition-colors">LearnForge</h3>
                  <p className="text-xs uppercase tracking-[0.15em] text-primary font-display mb-4">AI Learning & Career Advancement Tool</p>
                  <p className="text-white/55 text-sm font-serif leading-relaxed max-w-lg">
                    Turn any subject, document, or career goal into a full-length AI-powered practice exam — the real test experience, with fresh questions every time and an instant explanation for every answer. Built for students, professionals, and career-changers who need results.
                  </p>
                </div>

                {/* right: feature pills */}
                <div className="flex flex-col gap-3 md:min-w-[220px]">
                  {[
                    { icon: "🧠", label: "AI-Generated Practice Exams" },
                    { icon: "📄", label: "Upload Any Document or Goal" },
                    { icon: "⚡", label: "Instant Answer Explanations" },
                    { icon: "📊", label: "Score & Progress Tracking" },
                    { icon: "💼", label: "Career & Certification Prep" },
                    { icon: "✅", label: "Free to Start — No Card Needed" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3 bg-white/[0.04] border border-primary/10 rounded-lg px-4 py-2.5 group-hover:border-primary/25 transition-colors">
                      <span className="text-base">{f.icon}</span>
                      <span className="text-xs font-serif text-white/70">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-5">
                <span className="text-xs font-display uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/15">
                  Free to Start
                </span>
                <span className="text-primary text-sm font-serif flex items-center gap-1 group-hover:gap-3 transition-all duration-300">
                  Launch LearnForge <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </motion.a>
        </div>
      </section>

      <section className="py-24 container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-white/10 pb-6">
          <div>
            <h2 className="text-4xl font-display text-white mb-2">New & Featured Books</h2>
            <p className="text-muted-foreground font-serif">Fresh additions to our growing library — discover your next great read.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredBooks.map((book) => (
            <div key={book.id} className="h-full">
              <BookCard
                id={String(book.id)}
                title={book.title}
                author={book.author}
                price={parseFloat(book.price)}
                rating={parseFloat(book.rating)}
                cover={book.coverUrl}
                genre={book.genre}
                subscriberExclusiveUntil={book.subscriberExclusiveUntil}
                onBuy={() => handleAddToCart(book)}
              />
            </div>
          ))}
        </div>

        {newBooks.length > 6 && (
          <div className="text-center mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              className="border-primary/30 text-primary hover:bg-primary/10 font-display px-8 py-5"
              data-testid="button-toggle-featured"
            >
              {showAll ? "Show Less" : `Show All ${newBooks.length} Featured`}
              <ArrowRight className={`ml-2 h-4 w-4 transition-transform ${showAll ? "rotate-[-90deg]" : "rotate-90"}`} />
            </Button>
            <Link href="/catalog">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 font-display px-8 py-5" data-testid="button-browse-catalog">
                Browse Full Catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </section>

      <section className="py-16 border-t border-white/10">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-display text-white mb-6 text-center">Your One-Stop Digital Entertainment Library</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-muted-foreground font-serif text-sm leading-relaxed">
            <div>
              <h3 className="text-primary font-display text-base mb-2">600+ Ebooks Across Every Genre</h3>
              <p>
                EbookGamez offers a curated library of over 600 full-length ebooks spanning thriller, fantasy, romance,
                science fiction, horror, self-help, workbooks, and classic literature. Every title is available to read
                online instantly or download for keeps. Subscribe to our Reading Pass starting at $4.99/month for
                unlimited online reading and monthly download credits — no hidden fees.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-2">Games, Downloads & Expert Guides</h3>
              <p>
                Play 40+ free HTML5 browser games with no downloads required. Find official, verified download links for
                top PC and console titles including Fortnite, Minecraft, Roblox, Valorant, and GTA. Level up your
                gameplay with in-depth gaming guides covering pro settings, tier lists, strategies, and walkthroughs
                written by experienced players.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-2">LearnForge — AI-Powered Skill Building</h3>
              <p>
                Our featured learning partner LearnForge transforms any subject, document, or career goal into a
                full-length AI practice exam — complete with real-test-length questions, fresh content every session,
                and instant explanations for every answer. Whether you're studying for school, chasing a certification,
                or preparing for a career move, LearnForge helps you get there faster. Free to start, no card required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial content section — adds substantive text for SEO */}
      <section className="py-16 border-t border-white/10">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-2xl font-display text-white mb-10 text-center">What Makes EbookGamez Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-muted-foreground font-serif text-sm leading-relaxed mb-12">
            <div>
              <h3 className="text-primary font-display text-base mb-3">A Library Built for Modern Readers</h3>
              <p>
                Most ebook stores make you scroll through thousands of mediocre titles to find something worth reading. EbookGamez
                curates differently. Every book in our catalog — from psychological thrillers to business workbooks to illustrated
                graphic novels — goes through a content review before it reaches the shelf. Our collection spans over 30 genres
                including romance, science fiction, fantasy, horror, self-help, education, and a full classics section covering
                Dracula, Sherlock Holmes, Pride and Prejudice, Moby Dick, and more. Classics are free. Premium titles start at $1.99.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-3">Three Ways to Read — Your Choice</h3>
              <p>
                We don't lock you into one format. Every non-classic ebook offers three purchase options: read online only
                (35% cheaper than downloading), download to keep forever, or a bundle of both. Prefer not to commit? Our
                Reading Pass subscription starts at $4.99 per month and gives you unlimited online reading across the entire
                library plus monthly download credits that roll over if you don't use them. Cancel anytime — no contracts,
                no catch. We also offer a free 7-day trial on the Value plan so you can explore before you subscribe.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-3">Games and Guides in the Same Place</h3>
              <p>
                EbookGamez started as a books platform, but our readers kept asking for more. Today we host 40+ free HTML5
                browser games — action, racing, puzzle, sports — playable instantly with no downloads or accounts required.
                Our Download Hub provides verified, official links to the biggest PC and console titles including Fortnite,
                Minecraft, Elden Ring, and Valorant. And our gaming guides section covers pro strategies, settings, tier
                lists, and walkthroughs written by players who have actually put the hours in.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-12">
            <h2 className="text-2xl font-display text-white mb-8 text-center">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-7 text-sm font-serif text-muted-foreground">
              <div>
                <h3 className="text-white font-display text-sm mb-2">Do I need an account to read ebooks?</h3>
                <p>For classic (free) books, no account is needed — just click and read. For premium ebooks, you need to
                either purchase the book or have an active Reading Pass subscription. Creating an account takes about 30
                seconds and lets you access everything you've bought from any device.</p>
              </div>
              <div>
                <h3 className="text-white font-display text-sm mb-2">What formats are the ebooks available in?</h3>
                <p>Our online reader works in any modern browser on desktop, tablet, or phone with no app required. Downloads
                are provided as PDF files compatible with any e-reader, tablet, or computer. Once you download a book, it's
                yours with no expiry date or DRM restrictions.</p>
              </div>
              <div>
                <h3 className="text-white font-display text-sm mb-2">How does the Reading Pass subscription work?</h3>
                <p>Choose from five tiers — Lite, Reader, Value, Premium, or VIP — billed monthly or annually (annual saves
                two months). Your subscription gives you unlimited online reading of the entire library plus a set number of
                download credits each month. Unused credits roll over to the next month (capped at your plan's monthly limit).
                Cancel at any time with no penalties.</p>
              </div>
              <div>
                <h3 className="text-white font-display text-sm mb-2">Are the browser games really free?</h3>
                <p>Yes — every game in our Game Hub is completely free to play. No sign-up, no payment, no download. The games
                run directly in your browser and are supported by advertising. We feature games across all major categories:
                action, arcade, puzzle, racing, sports, strategy, and multiplayer. New titles are added regularly.</p>
              </div>
              <div>
                <h3 className="text-white font-display text-sm mb-2">Is there a refund policy for ebook purchases?</h3>
                <p>Yes. We offer a 14-day refund window for any purchase that doesn't meet your expectations. Contact our
                support team within 14 days with your order details and we'll process a full refund. Subscriptions can be
                cancelled at any time and you retain access until the end of your current billing period.</p>
              </div>
              <div>
                <h3 className="text-white font-display text-sm mb-2">Can I read on mobile and tablet?</h3>
                <p>Absolutely. Our book reader is fully responsive and works on iPhone, Android, iPad, and any tablet or
                laptop browser. The reading experience adjusts to your screen size automatically. For the best experience on
                small screens we recommend landscape orientation, but portrait mode works well too.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white/5 border-t border-white/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display text-primary mb-6">Join the Literary Club</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 font-serif">
            Receive exclusive updates on new additions to our collection and curated reading lists inspired by classic cinema.
          </p>
          <div className="flex max-w-md mx-auto gap-2">
            <Input placeholder="Your email address" className="bg-black/30 border-white/10 font-serif" data-testid="input-newsletter-email" />
            <Button className="bg-primary text-black font-serif" data-testid="button-subscribe">Subscribe</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
