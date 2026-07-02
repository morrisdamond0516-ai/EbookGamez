import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, Clock, Eye, ChevronRight, TrendingUp, Star, Gamepad2, Swords, Target, Zap, Trophy } from "lucide-react";
import { GUIDES, GAME_FILTERS, type Guide } from "@/data/guides-data";

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  "Settings": Target,
  "Best Of": Star,
  "Building": Swords,
  "Tier List": TrendingUp,
  "Tutorial": BookOpen,
  "Map Guide": Gamepad2,
  "Money Guide": Trophy,
  "Loadouts": Zap,
  "Beginner": BookOpen,
  "Game Guide": Gamepad2,
  "Agent Guide": Swords,
};

function GuideCard({ guide, large }: { guide: Guide; large?: boolean }) {
  const Icon = CATEGORY_ICONS[guide.category] || BookOpen;

  return (
    <Link href={`/guides/${guide.id}`}>
      <motion.article
        data-testid={`card-guide-${guide.id}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-300 cursor-pointer h-full ${
          large ? "md:col-span-2 md:row-span-2" : ""
        }`}
      >
        <div className={`relative overflow-hidden ${large ? "h-64" : "h-40"}`}>
          <img
            src={guide.image}
            alt={guide.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          {guide.trending && (
            <span className="absolute top-3 left-3 bg-red-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> TRENDING
            </span>
          )}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white/80 text-[10px] font-serif px-2 py-1 rounded-full flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {guide.category}
          </div>
          <div className="absolute bottom-3 left-3">
            <span className="text-primary/80 text-xs font-serif">{guide.game}</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <h3 className={`font-display text-white group-hover:text-primary transition-colors leading-tight ${
            large ? "text-xl" : "text-sm"
          }`}>
            {guide.title}
          </h3>

          {(large || guide.featured) && (
            <p className="text-white/50 text-xs font-serif leading-relaxed line-clamp-2">
              {guide.excerpt}
            </p>
          )}

          <div className="flex items-center gap-3 text-[10px] text-white/40">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {guide.readTime}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {guide.views} views</span>
            <span>{guide.date}</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {guide.tags.map(tag => (
              <span key={tag} className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <span className="text-primary/60 text-xs flex items-center gap-1 group-hover:text-primary transition-colors">
            Read full guide <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </motion.article>
    </Link>
  );
}

export default function Guides() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState("All");

  useEffect(() => {
    document.title = "Gaming Guides - Tips, Strategies & Walkthroughs | EbookGamez";
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) desc.content = "Level up your game with expert gaming guides, pro tips, tier lists, settings guides, and walkthroughs for Fortnite, Roblox, Minecraft, Valorant, and more.";
    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      if (desc) desc.content = "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.";
    };
  }, []);

  const { data: dynamicData } = useQuery({
    queryKey: ["/api/dynamic-content/guides"],
    queryFn: async () => {
      const res = await fetch("/api/dynamic-content/guides");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const allGuides: Guide[] = dynamicData?.data || GUIDES;

  const filtered = allGuides.filter(g => {
    const matchSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGame = selectedGame === "All" || g.game === selectedGame;
    return matchSearch && matchGame;
  });

  const featuredGuides = filtered.filter(g => g.featured);
  const regularGuides = filtered.filter(g => !g.featured);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />

      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-primary font-serif text-sm tracking-widest uppercase">Gaming Guides</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-4">
              Level Up Your <span className="text-primary">Game</span>
            </h1>
            <p className="text-white/60 font-serif text-lg mb-8">
              Pro tips, tier lists, settings guides, and strategies for the games everyone is playing.
            </p>

            <div className="relative max-w-md mx-auto">
              <Input
                data-testid="input-search-guides"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/5 border-white/10 text-white pl-10 h-12 font-serif"
              />
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-white/30" />
            </div>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {GAME_FILTERS.map(game => (
              <button
                key={game}
                data-testid={`filter-guide-${game}`}
                onClick={() => setSelectedGame(game)}
                className={`px-4 py-2 rounded-full text-sm font-serif transition-all ${
                  selectedGame === game
                    ? "bg-primary text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                }`}
              >
                {game}
              </button>
            ))}
          </div>
        </div>
      </section>

      {featuredGuides.length > 0 && (
        <section className="pb-12 container mx-auto px-4">
          <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Featured Guides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredGuides.map((guide, i) => (
              <GuideCard key={guide.id} guide={guide} large={i === 0} />
            ))}
          </div>
        </section>
      )}

      <section className="pb-20 container mx-auto px-4">
        {featuredGuides.length > 0 && regularGuides.length > 0 && (
          <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> All Guides
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {regularGuides.map((guide, i) => (
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GuideCard guide={guide} />
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-white/40 font-serif">
            No guides found matching your search.
          </div>
        )}
      </section>

      <section className="py-16 bg-white/[0.02] border-t border-white/10">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-2xl font-display text-white mb-3">Want More Guides?</h2>
          <p className="text-white/50 font-serif mb-6">
            Check out our ebook collection for in-depth strategy guides, game lore, and more.
          </p>
          <Link href="/catalog">
            <Button className="bg-primary text-black hover:bg-primary/90 font-display gap-2">
              Browse Ebook Collection <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
