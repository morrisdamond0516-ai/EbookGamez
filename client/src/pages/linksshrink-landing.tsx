import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ExternalLink, Link2, Video, BarChart3, Zap, Globe, ChevronRight, Megaphone } from "lucide-react";

const FEATURES = [
  {
    icon: Link2,
    title: "Short Link Creation",
    desc: "Turn any long URL into a clean, branded short link in one click. Share everywhere — social, email, SMS, or print.",
  },
  {
    icon: Video,
    title: "Video Ad Generator",
    desc: "Create eye-catching video ads from your short links. Pick a template, add your copy, and export a ready-to-run ad in minutes.",
  },
  {
    icon: BarChart3,
    title: "Click Analytics",
    desc: "See exactly who's clicking, when, and from where. Real-time dashboards so you know what's working before you scale spend.",
  },
  {
    icon: Zap,
    title: "Instant Redirects",
    desc: "Sub-100ms redirect performance worldwide. Fast redirects mean better user experience and no lost clicks.",
  },
  {
    icon: Globe,
    title: "Geo & Device Targeting",
    desc: "Send mobile users to your app store listing and desktop users to your landing page — from the same short link.",
  },
  {
    icon: Megaphone,
    title: "Campaign Management",
    desc: "Organise links by campaign, tag them with UTM parameters, and compare performance across your ad channels in one view.",
  },
];

const STEPS = [
  { num: "01", label: "Paste your destination URL and create a short link" },
  { num: "02", label: "Generate a video ad from your link with one click" },
  { num: "03", label: "Share your short link across social and ad channels" },
  { num: "04", label: "Track clicks, conversions, and campaign ROI in real time" },
];

export default function LinksShrinkLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-24">
        {/* ambient glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-blue-500/[0.06] blur-3xl" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-block text-xs font-display uppercase tracking-[0.25em] text-primary/70 border border-primary/20 px-4 py-1.5 rounded-full mb-6">
              New · Short Links &amp; Video Ads
            </span>

            <h1 className="font-display text-5xl md:text-7xl text-white mb-6 leading-tight">
              <span className="text-primary">LinksShrink</span>
              <br />
              <span className="text-3xl md:text-4xl text-white/80 font-serif font-normal">
                Short Links. Video Ads. Real Results.
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-white/60 font-serif text-lg leading-relaxed mb-10">
              Create branded short links, generate compelling video ads from those links, and track
              every click with real-time analytics. Everything you need to run smarter ad campaigns,
              in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="https://linksshrink.com"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="cta-linksshrink-primary"
              >
                <Button
                  size="lg"
                  className="bg-primary text-black hover:bg-primary/90 font-display px-10 py-6 text-lg rounded-sm gap-2"
                >
                  Try LinksShrink Free
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
              <Link href="/">
                <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 font-display px-10 py-6 text-lg rounded-sm">
                  Back to EbookGamez
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-white/30 font-serif">Start creating short links and video ads today.</p>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 border-t border-white/8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl text-white mb-3">From Link to Ad in Minutes</h2>
            <p className="text-white/50 font-serif max-w-lg mx-auto">The fastest way to turn a destination URL into a running ad campaign.</p>
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
            <h2 className="font-display text-3xl md:text-4xl text-white mb-3">Everything in One Platform</h2>
            <p className="text-white/50 font-serif max-w-xl mx-auto">
              Short links, video ads, and analytics — no need to juggle three separate tools for your ad campaigns.
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

      {/* ── Use Cases ── */}
      <section className="py-20 border-t border-white/8 bg-white/[0.02]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="font-display text-3xl text-white mb-4">Built for Modern Marketers</h2>
          <p className="text-white/50 font-serif mb-10 max-w-2xl mx-auto">
            Whether you're running paid social, email campaigns, or influencer partnerships — LinksShrink gives you the links and creative you need.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { emoji: "📱", label: "Social Media", desc: "Shorten links for Instagram bios, TikTok profiles, and Twitter posts. Track which platforms drive the most traffic." },
              { emoji: "🎬", label: "Video Advertising", desc: "Generate short video ads from your links in minutes. No production team needed — create scroll-stopping creative instantly." },
              { emoji: "📊", label: "Performance Marketing", desc: "UTM tagging, click heatmaps, and campaign dashboards. Know your ROI down to the individual link." },
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
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-blue-900/30 via-stone-950 to-primary/10 p-12 max-w-3xl mx-auto">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] to-transparent" />
            <div className="relative z-10">
              <span className="text-5xl mb-4 block">🎬</span>
              <h2 className="font-display text-3xl md:text-4xl text-white mb-4">
                Ready to Shrink Your Links?
              </h2>
              <p className="text-white/55 font-serif mb-8 max-w-lg mx-auto">
                Join marketers using LinksShrink to create short links, launch video ads, and track every click. Start free today.
              </p>
              <a
                href="https://linksshrink.com"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="cta-linksshrink-footer"
              >
                <Button
                  size="lg"
                  className="bg-primary text-black hover:bg-primary/90 font-display px-12 py-6 text-lg rounded-sm gap-2"
                >
                  Open LinksShrink
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
