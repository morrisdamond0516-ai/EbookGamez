import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Link2, BarChart2, Shield, Zap, Globe, CheckCircle } from "lucide-react";

export default function LinksShrinkLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-blue-400/70 uppercase font-serif mb-4">Link Management & Video Ads</p>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
            LINKS<span className="text-blue-400">SHRINK</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/70 font-serif mb-4 leading-relaxed">
            Shorten · Track · Convert
          </p>
          <p className="text-white/50 font-serif max-w-xl mx-auto mb-10">
            Create short, branded links that track every click — plus generate video ads
            for your content without a camera or production team. Built for creators,
            marketers, and anyone serious about their online presence.
          </p>
          <a href="https://linksshrink.com" target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-blue-500 text-white font-semibold px-8 py-4 text-lg hover:bg-blue-400 transition-all">
              Try LinksShrink Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-black/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center font-display text-3xl text-white mb-14 tracking-wide">
            Everything You Need to Grow Online
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Link2, title: "Smart Short Links", desc: "Turn long, ugly URLs into clean branded links. Share them anywhere — social media, emails, bios, QR codes." },
              { icon: BarChart2, title: "Click Analytics", desc: "See exactly who clicked, where they came from, and when. Real data to back every marketing decision." },
              { icon: Zap, title: "Video Ad Generator", desc: "Create compelling video ads from text prompts or existing content — no studio, no filming, no editing skills needed." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-black/30 border border-white/10 rounded-xl p-6 text-center hover:border-blue-400/30 transition-colors">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="font-serif text-lg text-white mb-2">{title}</h3>
                <p className="text-white/50 text-sm font-serif leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl text-white text-center mb-12 tracking-wide">
            Why Creators & Marketers Use LinksShrink
          </h2>
          <div className="space-y-4">
            {[
              "Create short links in seconds — no technical knowledge needed",
              "Track every click with detailed analytics dashboards",
              "Generate professional video ads without expensive software",
              "Use branded links that build trust and boost click-through rates",
              "Perfect for authors, bloggers, e-commerce sellers, and content creators",
            ].map((point) => (
              <div key={point} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-white/70 font-serif">{point}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a href="https://linksshrink.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-blue-500 text-white font-semibold px-10 py-4 text-lg hover:bg-blue-400">
                Go to LinksShrink <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <p className="text-white/30 text-sm font-serif mt-4">linksshrink.com</p>
          </div>
        </div>
      </section>

      {/* Cross-sell */}
      <section className="py-16 px-4 bg-black/20 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-white/40 font-serif text-sm mb-2">Also from EbookGamez</p>
          <h3 className="font-display text-2xl text-white mb-4">600+ Ebooks on Marketing, Business & More</h3>
          <p className="text-white/50 font-serif mb-6">
            Level up your marketing knowledge with our full-text ebook library. Business,
            self-help, and strategy books — all DRM-free and instantly readable.
          </p>
          <a href="/catalog">
            <Button variant="outline" className="border-blue-400/40 text-blue-400 hover:bg-blue-400/10">
              Browse the Catalog
            </Button>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
