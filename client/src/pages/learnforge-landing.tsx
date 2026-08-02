import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, BookOpen, Trophy, Zap, Users, CheckCircle } from "lucide-react";

export default function LearnForgeLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-primary/70 uppercase font-serif mb-4">Free AI Learning Tool</p>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
            LEARN<span className="text-primary">FORGE</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/70 font-serif mb-4 leading-relaxed">
            Forge Skills · Ace Exams · Advance Your Career
          </p>
          <p className="text-white/50 font-serif max-w-xl mx-auto mb-10">
            An AI-powered learning companion that turns any subject into an interactive
            knowledge-building session. Ask questions, get explanations, test yourself —
            all in one place, completely free.
          </p>
          <a href="https://knowledge-builder.replit.app" target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-primary text-black font-semibold px-8 py-4 text-lg hover:bg-primary/90 transition-all">
              Start Learning Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-black/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center font-display text-3xl text-white mb-14 tracking-wide">
            How LearnForge Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Brain, title: "AI Tutor", desc: "Ask any question on any subject. Get clear, thorough explanations tailored to your level — from beginner to advanced." },
              { icon: BookOpen, title: "Study Any Topic", desc: "History, science, coding, literature, finance. If you can learn it, LearnForge can teach it." },
              { icon: Trophy, title: "Test Yourself", desc: "Generate quizzes on any topic to cement what you've learned and track your progress over time." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-black/30 border border-white/10 rounded-xl p-6 text-center hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-primary" />
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
            Why Students & Professionals Choose LearnForge
          </h2>
          <div className="space-y-4">
            {[
              "100% free — no subscription, no paywall, no credit card",
              "Works for any subject: academics, professional certs, personal growth",
              "Available 24/7 — study whenever it suits you",
              "Explains concepts in plain English, then digs deeper if you ask",
              "Pairs perfectly with EbookGamez's 600+ textbooks and study guides",
            ].map((point) => (
              <div key={point} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-white/70 font-serif">{point}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a href="https://knowledge-builder.replit.app" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-primary text-black font-semibold px-10 py-4 text-lg hover:bg-primary/90">
                Open LearnForge <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <p className="text-white/30 text-sm font-serif mt-4">Free. No account required.</p>
          </div>
        </div>
      </section>

      {/* Cross-sell */}
      <section className="py-16 px-4 bg-black/20 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-white/40 font-serif text-sm mb-2">Also from EbookGamez</p>
          <h3 className="font-display text-2xl text-white mb-4">600+ Ebooks to Read While You Learn</h3>
          <p className="text-white/50 font-serif mb-6">
            Pair your LearnForge sessions with our full-text ebook library. One Reading Pass gives you unlimited access.
          </p>
          <a href="/subscription">
            <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
              Explore Reading Pass
            </Button>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
