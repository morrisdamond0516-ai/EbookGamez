import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Input } from "@/components/ui/input";
import { BookOpen, Clock, ChevronRight, Search, Feather } from "lucide-react";
import { BLOG_POSTS, BLOG_CATEGORIES, type BlogPost } from "@/data/blog-data";

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.id}`}>
      <motion.article
        data-testid={`card-blog-${post.id}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="group h-full border border-white/10 bg-white/[0.03] rounded-lg p-5 hover:border-primary/30 transition-all cursor-pointer flex flex-col"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-primary/80 font-serif border border-primary/20 px-2 py-0.5 rounded-full">
            {post.category}
          </span>
          <span className="text-[10px] text-white/35 font-serif">{post.publishedAt}</span>
        </div>
        <h2 className="font-display text-lg text-white group-hover:text-primary transition-colors leading-snug mb-3">
          {post.title}
        </h2>
        <p className="text-white/50 text-sm font-serif leading-relaxed line-clamp-3 flex-1">{post.excerpt}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-[11px] text-white/40">
          <span className="font-serif">{post.author}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {post.readMinutes} min
          </span>
        </div>
        <span className="text-primary/60 text-xs flex items-center gap-1 mt-3 group-hover:text-primary transition-colors">
          Read article <ChevronRight className="h-3 w-3" />
        </span>
      </motion.article>
    </Link>
  );
}

export default function Blog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  useEffect(() => {
    document.title = "Blog — Reading, Quality & Education Essays | EbookGamez";
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) {
      desc.content =
        "Essays from EbookGamez founder Damond Morris on quality gates, DRM-free ownership, Reading Pass, schoolbooks, and building a catalog without becoming a content farm.";
    }
    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      if (desc) {
        desc.content =
          "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.";
      }
    };
  }, []);

  const filtered = BLOG_POSTS.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    const matchCat = category === "All" || p.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />

      <section className="relative pt-28 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Feather className="h-5 w-5 text-primary" />
              <span className="text-primary font-serif text-sm tracking-widest uppercase">Blog</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-4">
              Notes from the <span className="text-primary">Library</span>
            </h1>
            <p className="text-white/60 font-serif text-lg mb-8">
              Free essays on how EbookGamez builds books, treats ownership, and designs school-year learning materials — written by founder Damond Morris.
            </p>
            <div className="relative max-w-md mx-auto">
              <Input
                data-testid="input-search-blog"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border-white/10 text-white pl-10 h-12 font-serif"
              />
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-white/30" />
            </div>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {BLOG_CATEGORIES.map((cat) => (
              <button
                key={cat}
                data-testid={`filter-blog-${cat}`}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-serif transition-all ${
                  category === cat
                    ? "bg-primary text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-20 text-white/40 font-serif">No articles match your search.</div>
        )}
      </section>

      <section className="py-14 bg-white/[0.02] border-t border-white/10">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <BookOpen className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-display text-white mb-3">Meet the founder</h2>
          <p className="text-white/50 font-serif mb-6">
            Learn who runs EbookGamez, how we use AI assistance, and how to reach us in Las Vegas.
          </p>
          <Link href="/about" className="text-primary font-serif hover:underline inline-flex items-center gap-1">
            About EbookGamez <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
