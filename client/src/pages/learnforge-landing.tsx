import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ExternalLink, Sparkles, BookOpen, BrainCircuit, BadgeCheck, ChevronRight, BarChart3, FileText } from "lucide-react";

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "AI Quiz Builder",
    desc: "Paste any text, upload a document, or describe a topic — LearnForge generates a full-length, exam-ready quiz in seconds.",
  },
  {
    icon: FileText,
    title: "Career Path Generator",
    desc: "Set a role or certification target and get a personalised roadmap of skills, resources, and milestones to get there.",
  },
  {
    icon: BadgeCheck,
    title: "Practice Exams",
    desc: "Fresh questions on every attempt so you never just memorise the answers. Multiple-choice, true/false, and short-answer formats.",
  },
  {
    icon: BarChart3,
    title: "Score & Progress Tracking",
    desc: "See how your scores improve over time. Identify weak areas so you can focus your study where it counts.",
  },
  {
    icon: BookOpen,
    title: "Upload Any Document",
    desc: "Study notes, textbook chapters, job descriptions — turn any content you already have into an instant practice test.",
  },
  {
    icon: Sparkles,
    title: "Instant Answer Explanations",
    desc: "Every question comes with a clear AI explanation so you learn from mistakes rather than just moving on.",
  },
];

const STEPS = [
  { num: "01", label: "Describe your topic or upload a document" },
  { num: "02", label: "LearnForge generates a tailored practice exam" },
  { num: "03", label: "Take the quiz, review explanations, track your score" },
  { num: "04", label: "Repeat with fresh questions until you're exam-ready" },
];

export default function LearnForgeLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-24">
        {/* ambient glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-primary/[0.07] blur-3xl" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-block text-xs font-display uppercase tracking-[0.25em] text-primary/70 border border-primary/20 px-4 py-1.5 rounded-full mb-6">
              Free · AI-Powered Learning Tool
            </span>

            <h1 className="font-display text-5xl md:text-7xl text-white mb-6 leading-tight">
              <span className="text-primary">LearnForge</span>
              <br />
              <span className="text-3xl md:text-4xl text-white/80 font-serif font-normal">
                AI Learning &amp; Career Advancement
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-white/60 font-serif text-lg leading-relaxed mb-10">
              Turn any subject, document, or career goal into a full-length AI-powered
              practice exam — fresh questions every time, instant explanations for every
              answer. Built for students, professionals, and career-changers who need results.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="https://knowledge-builder.replit.app/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="cta-learnforge-primary"
              >
                <Button
                  size="lg"
                  className="bg-primary text-black hover:bg-primary/90 font-display px-10 py-6 text-lg rounded-sm gap-2"
                >
                  Start Learning Free
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
              <Link href="/">
                <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 font-display px-10 py-6 text-lg rounded-sm">
                  Back to EbookGamez
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-white/30 font-serif">No credit card required. Free to start.</p>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 border-t border-white/8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl text-white mb-3">How It Works</h2>
            <p className="text-white/50 font-serif max-w-lg mx-auto">Four steps from blank page to exam-ready confidence.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="relative bg-white/[0.03] border border-white/8 rounded-2xl p-6 text-center"
              >
                <div className="font-display text-4xl text-primary/30 mb-3">{step.num}</div>
                <p className="text-white/70 font-serif text-sm leading-relaxed">{step.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 border-t border-white/8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl text-white mb-3">Everything You Need to Study Smarter</h2>
            <p className="text-white/50 font-serif max-w-xl mx-auto">
              LearnForge combines AI quiz generation, career planning, and progress tracking into one free tool.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="bg-white/[0.03] border border-white/8 hover:border-primary/30 rounded-2xl p-7 transition-colors group"
              >
                <div className="bg-primary/10 rounded-xl p-3 inline-flex mb-4 border border-primary/15 group-hover:bg-primary/15 transition-colors">
                  <feat.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg text-white mb-2">{feat.title}</h3>
                <p className="text-white/50 font-serif text-sm leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section className="py-20 border-t border-white/8 bg-white/[0.02]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="font-display text-3xl text-white mb-4">Who Uses LearnForge?</h2>
          <p className="text-white/50 font-serif mb-10 max-w-2xl mx-auto">
            From high-school students to seasoned professionals pivoting to a new career — anyone with something to learn and a goal to hit.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { emoji: "🎓", label: "Students", desc: "Ace semester exams and standardised tests with AI-generated practice questions tailored to your syllabus." },
              { emoji: "💼", label: "Professionals", desc: "Prepare for certifications, promotions, and interviews. Upload your study material and test yourself instantly." },
              { emoji: "🔄", label: "Career-Changers", desc: "Map out the skills you need, build them systematically, and track your progress toward your new role." },
            ].map(item => (
              <div key={item.label} className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                <div className="text-4xl mb-3">{item.emoji}</div>
                <h3 className="font-display text-white text-lg mb-2">{item.label}</h3>
                <p className="text-white/50 font-serif text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 border-t border-white/8">
        <div className="container mx-auto px-4 text-center">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-amber-900/40 via-stone-950 to-yellow-950/30 p-12 max-w-3xl mx-auto">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.07] to-transparent" />
            <div className="relative z-10">
              <span className="text-5xl mb-4 block">🎓</span>
              <h2 className="font-display text-3xl md:text-4xl text-white mb-4">
                Ready to Forge Your Skills?
              </h2>
              <p className="text-white/55 font-serif mb-8 max-w-lg mx-auto">
                Join learners using LearnForge to pass exams, earn certifications, and land the careers they want. It's free to start — no card needed.
              </p>
              <a
                href="https://knowledge-builder.replit.app/"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="cta-learnforge-footer"
              >
                <Button
                  size="lg"
                  className="bg-primary text-black hover:bg-primary/90 font-display px-12 py-6 text-lg rounded-sm gap-2"
                >
                  Open LearnForge Free
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30 font-serif">
                <ChevronRight className="h-3 w-3" />
                A companion tool from EbookGamez · <Link href="/" className="underline underline-offset-2 hover:text-white/60 transition-colors">Back to EbookGamez</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
