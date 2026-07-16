import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import { BookOpen, Gamepad2, Download, FileText, Shield, Heart, Zap, Feather, ChevronRight } from "lucide-react";

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
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-4 text-center" data-testid="text-about-title">
            About EbookGamez
          </h1>
          <p className="text-center text-muted-foreground font-serif text-lg mb-16">
            A Las Vegas indie digital library — named founder, public standards, books you can keep.
          </p>

          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-8">
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Heart className="h-6 w-6 text-primary" />
                Who runs this
              </h2>
              <p>
                <span className="text-white">EbookGamez</span> is founded and operated by{" "}
                <span className="text-white">Damond Morris</span>, based in Las Vegas, Nevada. This is not an anonymous
                catalog farm. When you email support, buy a download, or ask how a schoolbook was built, you are reaching
                the person responsible for the storefront.
              </p>
              <p>
                I built EbookGamez so readers could find affordable full-length ebooks they can{" "}
                <span className="text-white">own as DRM-free downloads</span>, plus free browser games, verified download
                links, and practical guides — without hunting five half-trustworthy sites. The catalog spans fiction,
                nonfiction, education, and free public-domain classics.
              </p>
              <p className="mb-0">
                Read the process essays on our{" "}
                <Link href="/blog" className="text-primary underline hover:text-primary/80">
                  Blog
                </Link>{" "}
                — quality gates, Reading Pass honesty, schoolbooks design, and AI disclosure — or{" "}
                <Link href="/contact" className="text-primary underline hover:text-primary/80">
                  contact us
                </Link>{" "}
                directly.
              </p>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Zap className="h-6 w-6 text-primary" />
                Why EbookGamez exists
              </h2>
              <p>
                Most digital shelves optimize for endless scrolling. I wanted a hub that answers the questions that matter
                before you spend money: Who stands behind this? What happens after purchase? Can I keep the file? If
                something breaks, can I reach a real person?
              </p>
              <p className="mb-0">
                We grow the catalog with researched titles, cover-first production for serious books, outline-driven
                writing, and quality gates that can fail a draft instead of rubber-stamping it to the storefront. Volume
                without those checks is how sites become disposable. We refuse that path.
              </p>
            </div>

            <h2 className="text-2xl font-display text-white mt-12 mb-6 text-center">What we offer</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-ebooks">
                <div className="flex items-center gap-3 mb-3">
                  <BookOpen className="h-5 w-5 text-amber-400" />
                  <h3 className="text-lg font-display text-white m-0">Ebook Store</h3>
                </div>
                <p className="text-sm m-0">
                  Hundreds of full-length ebooks across fiction, nonfiction, education, and more. DRM-free downloads when
                  you buy to keep. Online reading and Reading Pass options when you want flexibility. Free public-domain
                  classics included.
                </p>
              </div>

              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-games">
                <div className="flex items-center gap-3 mb-3">
                  <Gamepad2 className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-display text-white m-0">Free Browser Games</h3>
                </div>
                <p className="text-sm m-0">
                  40+ free HTML5 games you can play in the browser — no downloads required. Action, racing, puzzles,
                  sports, and more.
                </p>
              </div>

              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-downloads">
                <div className="flex items-center gap-3 mb-3">
                  <Download className="h-5 w-5 text-green-400" />
                  <h3 className="text-lg font-display text-white m-0">Download Hub</h3>
                </div>
                <p className="text-sm m-0">
                  Curated links to official download pages for popular game titles — so you are not guessing which
                  installer is safe.
                </p>
              </div>

              <div className="p-5 bg-white/5 border border-white/10 rounded-xl" data-testid="card-about-guides">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="h-5 w-5 text-purple-400" />
                  <h3 className="text-lg font-display text-white m-0">Guides & Blog</h3>
                </div>
                <p className="text-sm m-0">
                  Gaming guides for popular titles, plus founder essays on quality, ownership, and schoolbooks — free to
                  read with no purchase required.
                </p>
              </div>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl mt-8">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                Our standards
              </h2>
              <p>
                Serious titles follow a cover-first path, detailed outlines, and publish gates that check structure,
                illustrations (when the genre requires them), and genre-appropriate quality. Educational books are judged
                as instructional materials — objectives, practice, and checks — not as novels with a fake climax score.
              </p>
              <p>
                Every ebook you purchase as a download is <span className="text-white font-semibold">DRM-free</span>.
                Back it up. Read it offline. It is your copy for personal use under our store terms — not a temporary
                stream that vanishes when a deal ends.
              </p>
              <p className="text-sm text-white/60 border border-white/10 rounded-lg px-4 py-3 bg-white/5 mb-0">
                <span className="text-primary font-semibold">AI Content Disclosure:</span> Ebook text, cover artwork, and
                illustrations on EbookGamez are generated with the assistance of artificial intelligence (AI) tools. All
                AI-assisted content is reviewed against our quality gates before Ready or Published status. Assistance is
                not a substitute for those checks.
              </p>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h2 className="text-2xl font-display text-white mb-4 flex items-center gap-3">
                <Feather className="h-6 w-6 text-primary" />
                From the blog
              </h2>
              <p className="mb-4">
                If you want the long version of how we work — without buying anything — start here:
              </p>
              <ul className="space-y-2 text-sm m-0 list-none pl-0">
                <li>
                  <Link href="/blog/why-ebookgamez-exists" className="text-primary hover:underline inline-flex items-center gap-1">
                    Why EbookGamez exists <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
                <li>
                  <Link href="/blog/how-we-quality-check-books" className="text-primary hover:underline inline-flex items-center gap-1">
                    How we quality-check books <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
                <li>
                  <Link href="/blog/ai-assistance-and-human-review" className="text-primary hover:underline inline-flex items-center gap-1">
                    AI assistance and human review <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-white/70 hover:text-primary inline-flex items-center gap-1">
                    All blog articles <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            </div>

            <div className="my-12 p-8 bg-white/5 border border-white/10 rounded-lg text-center italic">
              "A room without books is like a body without a soul."
              <br />
              <span className="text-sm not-italic text-primary mt-2 block">— Cicero</span>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center">
              <h2 className="text-2xl font-display text-white mb-4">Get in touch</h2>
              <div className="space-y-2">
                <p className="text-white/70 font-serif m-0">
                  Damond Morris · EbookGamez
                  <br />
                  P.O. Box 1181
                  <br />
                  Las Vegas, NV 89125
                </p>
                <p className="text-sm text-white/50 m-0 mt-3">
                  Email:{" "}
                  <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">
                    ebookgames@yahoo.com
                  </a>
                </p>
                <p className="text-xs text-white/30 mt-4 m-0">
                  Have a question? Try live chat (bottom-right) or the{" "}
                  <Link href="/contact" className="text-primary/80 underline">
                    contact page
                  </Link>
                  .
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
