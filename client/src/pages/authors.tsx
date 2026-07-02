import { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Send, CheckCircle, DollarSign, Users, Shield, Loader2 } from "lucide-react";

export default function Authors() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", bio: "", genre: "", sampleWorkUrl: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.bio || !form.genre) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/author-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        toast({ title: data.error || "Submission failed", variant: "destructive" });
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
            Publish With EbookGamez
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Reach thousands of readers. Keep more of what you earn. Your stories deserve a home.
          </motion.p>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: DollarSign, title: "70% Royalties", desc: "You keep 70% of every sale. We handle hosting, payments, and marketing — you focus on writing.", color: "text-emerald-400" },
            { icon: Users, title: "Growing Audience", desc: "Our library has 545+ titles and thousands of monthly visitors actively looking for new reads.", color: "text-blue-400" },
            { icon: Shield, title: "Full Control", desc: "Set your own pricing. Update your work anytime. No exclusivity requirements — publish everywhere.", color: "text-amber-400" },
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

        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-emerald-500/30 bg-emerald-500/5 text-center">
                <CardContent className="py-12">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-display text-white mb-2">Application Received!</h2>
                  <p className="text-muted-foreground font-serif max-w-md mx-auto">
                    Thank you for your interest. We review every submission personally and will reach out to you at <span className="text-white">{form.email}</span> within a few business days.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className="border-white/10 bg-card/50">
              <CardHeader>
                <CardTitle className="font-display text-primary flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Author Application
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Full Name *</label>
                      <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Your name" data-testid="input-author-name" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Email *</label>
                      <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" data-testid="input-author-email" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Primary Genre *</label>
                    <Input value={form.genre} onChange={e => update("genre", e.target.value)} placeholder="e.g., Mystery, Self-Help, Romance" data-testid="input-author-genre" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">About You & Your Work *</label>
                    <textarea
                      value={form.bio}
                      onChange={e => update("bio", e.target.value)}
                      placeholder="Tell us about yourself, your writing experience, and what you'd like to publish with us..."
                      rows={4}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-primary focus:outline-none resize-none text-sm"
                      data-testid="input-author-bio"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Sample Work Link (optional)</label>
                    <Input value={form.sampleWorkUrl} onChange={e => update("sampleWorkUrl", e.target.value)} placeholder="https://..." data-testid="input-author-sample" />
                    <p className="text-xs text-muted-foreground mt-1">Link to a published book, blog, or writing portfolio</p>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-black hover:bg-primary/90 font-display text-lg py-5" data-testid="button-submit-author">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                    Submit Application
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: "Cinzel, serif" }}>
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { step: "1", title: "Apply", desc: "Submit your application with your writing background and genre." },
              { step: "2", title: "Review", desc: "Our team reviews your submission and reaches out within a few days." },
              { step: "3", title: "Publish & Earn", desc: "Once approved, your books go live and you earn 70% of every sale." },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.1 }}>
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-display text-lg flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-display text-white mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-serif">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
