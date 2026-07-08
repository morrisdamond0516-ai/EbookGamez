import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function NewsletterSignup({
  source,
  title = "Join the Literary Club",
  description = "New ebooks, free games, and LearnForge learning updates — occasional email, no spam.",
  compact = false,
  className = "",
}: {
  source: string;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        toast({
          title: "Could not subscribe",
          description: data.error ?? "Please try again later.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "You're subscribed",
        description: data.message ?? "Check your inbox for a welcome email.",
      });
      setEmail("");
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server. Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <form onSubmit={submit} className={`flex gap-2 ${className}`}>
        <Input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="bg-black/30 border-white/10 font-serif flex-1"
          data-testid="input-newsletter-email"
          aria-label="Email for Literary Club"
        />
        <Button
          type="submit"
          disabled={loading}
          className="bg-primary text-black font-serif"
          data-testid="button-subscribe"
        >
          {loading ? "…" : "Subscribe"}
        </Button>
      </form>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-center gap-2 text-primary">
        <Mail className="h-5 w-5" />
        <h3 className="font-display text-xl">{title}</h3>
      </div>
      <p className="text-muted-foreground max-w-xl mx-auto mb-6 font-serif text-center">{description}</p>
      <form onSubmit={submit} className="flex max-w-md mx-auto gap-2">
        <Input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="bg-black/30 border-white/10 font-serif"
          data-testid="input-newsletter-email"
          aria-label="Email for Literary Club"
        />
        <Button
          type="submit"
          disabled={loading}
          className="bg-primary text-black font-serif"
          data-testid="button-subscribe"
        >
          {loading ? "Subscribing…" : "Subscribe"}
        </Button>
      </form>
    </div>
  );
}
