import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import { BookOpen, Gamepad2, Download, FileText, Shield, Heart, Zap } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <Navbar />
      
      <div className="container mx-auto px-4 py-32 flex-1">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-4 text-center" data-testid="text-about-title">About EbookGamez</h1>
          <p className="text-center text-muted-foreground font-serif text-lg mb-16">Your digital entertainment destination — ebooks, games, guides, and more.</p>
          
          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-8">

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Heart className="h-6 w-6 text-primary" />
                Who We Are
              </h2>
              <p>
                <span className="text-white">EbookGamez</span> is a digital platform based in Las Vegas, Nevada, built for readers, gamers, and curious minds. We bring together a growing library of ebooks across dozens of genres, free browser games you can play instantly, a download hub for popular game titles, and in-depth gaming guides — all in one place.
              </p>
              <p>
                We believe great content should be accessible, straightforward, and enjoyable. No gimmicks, no hidden fees — just quality digital entertainment.
              </p>
            </div>

            <h2 className="text-2xl font-display text-white mt-12 mb-6 text-center">What We Offer</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-ebooks">
                <div className="flex items-center gap-3 mb-3">
                  <BookOpen className="h-5 w-5 text-amber-400" />
                  <h3 className="text-lg font-display text-white m-0">Ebook Store</h3>
                </div>
                <p className="text-sm m-0">
                  545+ ebooks spanning fiction, non-fiction, self-help, business, horror, romance, sci-fi, and many more genres. Our books are DRM-free — when you buy a book, you own it. Read online in our built-in reader or download to keep forever. We also offer free access to public domain classics.
                </p>
              </div>

              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-games">
                <div className="flex items-center gap-3 mb-3">
                  <Gamepad2 className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-display text-white m-0">Free Browser Games</h3>
                </div>
                <p className="text-sm m-0">
                  40+ free HTML5 games you can play right in your browser — no downloads required. Action, racing, puzzles, sports, and more. New titles added regularly. Just click and play.
                </p>
              </div>

              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-downloads">
                <div className="flex items-center gap-3 mb-3">
                  <Download className="h-5 w-5 text-green-400" />
                  <h3 className="text-lg font-display text-white m-0">Download Hub</h3>
                </div>
                <p className="text-sm m-0">
                  Safe, verified links to official download pages for popular game titles. We curate the best free-to-play and downloadable games so you can find what you're looking for without the hassle.
                </p>
              </div>

              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-guides">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="h-5 w-5 text-purple-400" />
                  <h3 className="text-lg font-display text-white m-0">Gaming Guides</h3>
                </div>
                <p className="text-sm m-0">
                  Detailed strategy guides, walkthroughs, and tips for today's most popular games. Whether you're building a gaming PC or mastering a new title, our guides have you covered.
                </p>
              </div>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl mt-8">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                Own Your Books
              </h2>
              <p>
                We take a different approach to digital books. Every ebook you purchase from EbookGamez is <span className="text-white font-semibold">DRM-free</span>. That means no restrictions, no expiration dates, and no limits on how you read your books. Download them, back them up, read them on any device — they're yours.
              </p>
              <p>
                We also offer a <span className="text-white">Reading Pass</span> subscription with five flexible tiers, giving you monthly reading and download credits at a fraction of individual purchase prices.
              </p>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Zap className="h-6 w-6 text-primary" />
                Our Approach
              </h2>
              <p>
                Every ebook in our store is crafted using advanced AI-assisted writing and image generation technology, then reviewed for quality before publication. Our content generation pipeline ensures each book delivers rich, engaging prose — whether it's a gripping thriller, a practical self-help guide, or an in-depth exploration of history.
              </p>
              <p className="text-sm text-white/60 border border-white/10 rounded-lg px-4 py-3 bg-white/5">
                <span className="text-primary font-semibold">AI Content Disclosure:</span> Ebook text, cover artwork, and interior illustrations on EbookGamez are generated with the assistance of artificial intelligence (AI) tools. All AI-generated content is reviewed before publication to ensure quality and accuracy.
              </p>
              <p>
                We're constantly growing our catalog, adding new books, games, and guides. Our goal is to be the go-to platform for affordable, high-quality digital entertainment.
              </p>
            </div>

            <div className="my-12 p-8 bg-white/5 border border-white/10 rounded-lg text-center italic">
              "A room without books is like a body without a soul."
              <br />
              <span className="text-sm not-italic text-primary mt-2 block">— Cicero</span>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center">
              <h2 className="text-2xl font-display text-white mb-4">Get in Touch</h2>
              <div className="space-y-2">
                <p className="text-white/70 font-serif m-0">
                  EbookGamez<br />
                  P.O. Box 1181<br />
                  Las Vegas, NV 89125
                </p>
                <p className="text-sm text-white/50 m-0 mt-3">
                  Email: <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">Email Support</a>
                </p>
                <p className="text-xs text-white/30 mt-4 m-0">
                  Have a question? Try our live chat — the support icon is in the bottom-right corner of every page.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
