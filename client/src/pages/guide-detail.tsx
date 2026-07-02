import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Eye, Calendar, Tag, ChevronRight, BookOpen } from "lucide-react";
import { GUIDES, type Guide } from "@/data/guides-data";

export default function GuideDetail() {
  const params = useParams<{ id: string }>();

  const { data: dynamicData } = useQuery({
    queryKey: ["/api/dynamic-content/guides"],
    queryFn: async () => {
      const res = await fetch("/api/dynamic-content/guides");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const allGuides: Guide[] = dynamicData?.data || GUIDES;
  const guide = allGuides.find(g => g.id === params.id);

  useEffect(() => {
    if (!guide) return;
    document.title = `${guide.title} - ${guide.game} Guide | EbookGamez`;
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) desc.content = `${guide.title}. Expert tips, strategies, and walkthroughs for ${guide.game} on EbookGamez.`;
    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      if (desc) desc.content = "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.";
    };
  }, [guide?.id]);

  if (!guide) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body">
        <Navbar />
        <div className="pt-32 pb-20 container mx-auto px-4 text-center">
          <h1 className="text-3xl font-display text-white mb-4">Guide Not Found</h1>
          <p className="text-white/50 font-serif mb-8">The guide you're looking for doesn't exist.</p>
          <Link href="/guides">
            <Button className="bg-primary text-black hover:bg-primary/90 font-display gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Guides
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const relatedGuides = GUIDES.filter(g => g.id !== guide.id && g.game === guide.game).slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />

      <div className="relative h-[40vh] min-h-[300px] overflow-hidden">
        <img src={guide.image} alt={guide.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/40" />
        <div className="absolute bottom-0 left-0 right-0 container mx-auto px-4 pb-8">
          <Link href="/guides">
            <span className="text-primary/70 text-sm font-serif hover:text-primary transition-colors flex items-center gap-1 mb-4 cursor-pointer">
              <ArrowLeft className="h-3 w-3" /> Back to Guides
            </span>
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-primary/20 text-primary text-xs font-serif px-3 py-1 rounded-full border border-primary/30">
              {guide.game}
            </span>
            <span className="bg-white/10 text-white/60 text-xs font-serif px-3 py-1 rounded-full">
              {guide.category}
            </span>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-display text-white mb-4 max-w-4xl leading-tight"
          >
            {guide.title}
          </motion.h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {guide.readTime} read</span>
            <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {guide.views} views</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {guide.date}</span>
          </div>
        </div>
      </div>

      <article className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-white/70 font-serif leading-relaxed mb-10 border-l-2 border-primary/40 pl-6"
        >
          {guide.excerpt}
        </motion.p>

        <div className="flex flex-wrap gap-2 mb-10">
          {guide.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs bg-white/5 text-white/50 px-3 py-1.5 rounded-full border border-white/10">
              <Tag className="h-3 w-3" /> {tag}
            </span>
          ))}
        </div>

        <div className="space-y-10">
          {guide.content.map((section, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <span className="text-primary/40 text-lg font-mono">{String(i + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              <div className="text-white/60 font-serif leading-relaxed space-y-4">
                {section.body.split('\n\n').map((paragraph, j) => (
                  <p key={j} className={paragraph.startsWith('•') || paragraph.startsWith('1.') ? "pl-4" : ""}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </article>

      {relatedGuides.length > 0 && (
        <section className="border-t border-white/10 py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> More {guide.game} Guides
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedGuides.map(rg => (
                <Link key={rg.id} href={`/guides/${rg.id}`}>
                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer group">
                    <span className="text-primary/60 text-xs font-serif">{rg.category}</span>
                    <h3 className="font-display text-sm text-white group-hover:text-primary transition-colors mt-1 leading-tight">
                      {rg.title}
                    </h3>
                    <span className="text-white/30 text-xs flex items-center gap-1 mt-2">
                      Read more <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12 bg-white/[0.02] border-t border-white/10">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-xl font-display text-white mb-3">Want In-Depth Strategy Ebooks?</h2>
          <p className="text-white/50 font-serif text-sm mb-6">
            Our ebook collection includes comprehensive strategy guides, game lore, and more — available for instant download.
          </p>
          <Link href="/catalog">
            <Button className="bg-primary text-black hover:bg-primary/90 font-display gap-2">
              Browse Ebook Store <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
