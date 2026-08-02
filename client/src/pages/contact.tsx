import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !email.trim().includes("@")) {
      toast({
        title: "Almost there",
        description: "Please enter a valid email and your message.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Contact form\nName: ${name.trim() || "(not given)"}\nEmail: ${email.trim()}\n\n${message.trim()}`,
          source: "contact-page",
          email: email.trim(),
          name: name.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setSent(true);
      setMessage("");
      toast({ title: "Message sent", description: "We’ll reply within 24–48 hours." });
    } catch {
      toast({
        title: "Could not send",
        description: "Email us directly at ebookgames@yahoo.com",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <Navbar />

      <div className="container mx-auto px-4 py-28 md:py-32 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-4 text-center" data-testid="text-contact-title">
            Contact Us
          </h1>
          <p className="text-center text-muted-foreground font-serif text-lg mb-10">
            Questions about a purchase, Reading Pass, or the catalog? We typically reply within 24–48 hours.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="p-6 bg-white/5 border border-white/10 rounded-lg text-center">
              <Mail className="w-10 h-10 text-primary mx-auto mb-3" aria-hidden="true" />
              <h2 className="text-xl font-display text-white mb-2">Email</h2>
              <a
                href="mailto:ebookgames@yahoo.com"
                className="text-primary text-lg underline hover:opacity-80 transition-opacity break-all"
                data-testid="link-contact-email"
              >
                ebookgames@yahoo.com
              </a>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-lg text-center">
              <h2 className="text-xl font-display text-white mb-2">Mail</h2>
              <p className="text-muted-foreground font-serif text-sm leading-relaxed">
                EbookGamez<br />
                P.O. Box 1181<br />
                Las Vegas, NV 89125
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-6 md:p-8 bg-white/5 border border-white/10 rounded-lg space-y-4"
            data-testid="form-contact"
          >
            <h2 className="text-2xl font-display text-white text-center mb-2">Send a message</h2>
            {sent ? (
              <p className="text-center text-emerald-400 font-serif py-6" data-testid="text-contact-sent">
                Thanks — your message is in. We’ll get back to you soon.
              </p>
            ) : (
              <>
                <div>
                  <label htmlFor="contact-name" className="text-xs uppercase tracking-wider text-white/60 font-serif mb-1.5 block">
                    Name
                  </label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-black/30 border-white/15"
                    placeholder="Your name"
                    autoComplete="name"
                    data-testid="input-contact-name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="text-xs uppercase tracking-wider text-white/60 font-serif mb-1.5 block">
                    Email
                  </label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-black/30 border-white/15"
                    placeholder="you@email.com"
                    autoComplete="email"
                    data-testid="input-contact-email"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="text-xs uppercase tracking-wider text-white/60 font-serif mb-1.5 block">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-black/30 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 resize-y focus:outline-none focus:border-primary/60"
                    placeholder="How can we help?"
                    data-testid="input-contact-message"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-primary text-black hover:bg-primary/90 font-display"
                  data-testid="button-contact-submit"
                >
                  <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                  {sending ? "Sending…" : "Send message"}
                </Button>
              </>
            )}
          </form>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
