import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Calendar, ChevronRight, BookOpen, Feather } from "lucide-react";
import { getBlogPost, getRelatedPosts, BLOG_POSTS } from "@/data/blog-data";

export default function BlogPost() {
  const params = useParams<{ id: string }>();
  const post = getBlogPost(params.id || "");

  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | EbookGamez Blog`;
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) desc.content = post.excerpt;
    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      if (desc) {
        desc.content =
          "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.";
      }
    };
  }, [post?.id]);

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body">
        <Navbar />
        <div className="pt-32 pb-20 container mx-auto px-4 text-center">
          <h1 className="text-3xl font-display text-white mb-4">Article Not Found</h1>
          <p className="text-white/50 font-serif mb-8">That blog post does not exist.</p>
          <Link href="/blog">
            <Button className="bg-primary text-black hover:bg-primary/90 font-display gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const related = getRelatedPosts(post, 3);
  const fallbackRelated =
    related.length > 0 ? related : BLOG_POSTS.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />

      <header className="pt-28 pb-10 border-b border-white/10">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link href="/blog">
            <span className="text-primary/70 text-sm font-serif hover:text-primary transition-colors flex items-center gap-1 mb-6 cursor-pointer">
              <ArrowLeft className="h-3 w-3" /> Back to Blog
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="bg-primary/20 text-primary text-xs font-serif px-3 py-1 rounded-full border border-primary/30">
              {post.category}
            </span>
            <span className="text-white/40 text-xs font-serif flex items-center gap-1">
              <Feather className="h-3 w-3" /> {post.author}
            </span>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-display text-white mb-5 leading-tight"
          >
            {post.title}
          </motion.h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {post.readMinutes} min read
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" /> {post.publishedAt}
            </span>
          </div>
        </div>
      </header>

      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg text-white/70 font-serif leading-relaxed mb-12 border-l-2 border-primary/40 pl-6"
        >
          {post.excerpt}
        </motion.p>

        <div className="space-y-10">
          {post.sections.map((section, i) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <span className="text-primary/40 text-lg font-mono">{String(i + 1).padStart(2, "0")}</span>
                {section.heading}
              </h2>
              <div className="text-white/60 font-serif leading-relaxed space-y-4">
                {section.body.split("\n\n").map((paragraph, j) => (
                  <p key={j}>{paragraph}</p>
                ))}
              </div>
            </motion.section>
          ))}
        </div>

        {post.relatedHref && (
          <div className="mt-12 p-6 border border-white/10 bg-white/[0.03] rounded-lg">
            <p className="text-white/50 font-serif text-sm mb-3">Continue exploring</p>
            <Link href={post.relatedHref} className="text-primary font-display hover:underline inline-flex items-center gap-1">
              Open related page <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </article>

      <section className="border-t border-white/10 py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-xl font-display text-white mb-6 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> More from the blog
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {fallbackRelated.map((rp) => (
              <Link key={rp.id} href={`/blog/${rp.id}`}>
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer group h-full">
                  <span className="text-primary/60 text-xs font-serif">{rp.category}</span>
                  <h3 className="font-display text-sm text-white group-hover:text-primary transition-colors mt-1 leading-tight">
                    {rp.title}
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

      <Footer />
    </div>
  );
}
