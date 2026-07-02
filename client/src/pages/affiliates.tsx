import { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link2, Send, CheckCircle, DollarSign, BarChart3, Zap, Loader2 } from "lucide-react";

export default function Affiliates() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", website: "", socialMedia: "", audienceSize: "", reason: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.reason) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        toast({ title: data.error || "Application failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            Earn With EbookGamez
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Share books you love. Earn 15% commission on every sale you refer. No cap on earnings.
          </motion.p>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: DollarSign, title: "15% Commission", desc: "Earn 15% of every sale made through your unique referral link. No minimum payout threshold.", color: "text-emerald-400" },
            { icon: BarChart3, title: "Real-Time Tracking", desc: "See your clicks, conversions, and earnings in your personal affiliate dashboard.", color: "text-blue-400" },
            { icon: Zap, title: "Instant Setup", desc: "Get approved, grab your link, and start earning. We provide banners, copy, and support.", color: "text-amber-400" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
              <Card className="h-full border-white/10 bg-card/50">
                <CardContent className="pt-6 text-center">
                  <item.icon className={`w-10 h-10 mx-auto mb-4 ${item.color}`} />
                  <h3 className="text-lg font-display text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground font-serif">{item.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: "Cinzel, serif" }}>
            How Much Can You Earn?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { referrals: "10 sales/mo", earning: "$25 – $40", level: "Starter" },
              { referrals: "50 sales/mo", earning: "$125 – $200", level: "Growing" },
              { referrals: "200+ sales/mo", earning: "$500+", level: "Power Affiliate" },
            ].map((tier, i) => (
              <Card key={i} className={`border-white/10 bg-card/50 ${i === 2 ? "border-primary/30" : ""}`}>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{tier.level}</p>
                  <p className="text-2xl font-display text-primary mb-1">{tier.earning}</p>
                  <p className="text-sm text-muted-foreground">{tier.referrals}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-emerald-500/30 bg-emerald-500/5 text-center">
                <CardContent className="py-12">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-display text-white mb-2">Application Received!</h2>
                  <p className="text-muted-foreground font-serif max-w-md mx-auto">
                    We'll review your application and send your affiliate details to <span className="text-white">{form.email}</span> once approved.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className="border-white/10 bg-card/50">
              <CardHeader>
                <CardTitle className="font-display text-primary flex items-center gap-2">
                  <Link2 className="w-5 h-5" /> Affiliate Application
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Full Name *</label>
                      <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Your name" data-testid="input-affiliate-name" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Email *</label>
                      <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" data-testid="input-affiliate-email" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Website (optional)</label>
                      <Input value={form.website} onChange={e => update("website", e.target.value)} placeholder="https://yoursite.com" data-testid="input-affiliate-website" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Social Media (optional)</label>
                      <Input value={form.socialMedia} onChange={e => update("socialMedia", e.target.value)} placeholder="@handle or profile link" data-testid="input-affiliate-social" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Audience Size (optional)</label>
                    <Input value={form.audienceSize} onChange={e => update("audienceSize", e.target.value)} placeholder="e.g., 5K followers, 10K monthly readers" data-testid="input-affiliate-audience" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Why do you want to promote EbookGamez? *</label>
                    <textarea
                      value={form.reason}
                      onChange={e => update("reason", e.target.value)}
                      placeholder="Tell us about your audience and how you'd promote our books..."
                      rows={4}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-primary focus:outline-none resize-none text-sm"
                      data-testid="input-affiliate-reason"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-black hover:bg-primary/90 font-display text-lg py-5" data-testid="button-submit-affiliate">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                    Apply Now
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
