import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2 } from "lucide-react";

export function BookRequestBanner() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/book-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestText: requestText.trim(),
          customerEmail: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      toast({ title: "Suggestion received", description: "We'll review your idea for a future ebook." });
      setRequestText("");
      setEmail("");
      setOpen(false);
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-10" data-testid="section-book-request">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Want a book we don't have yet?
            </h2>
            <p className="text-sm text-muted-foreground font-serif mt-1 max-w-xl">
              Tell us what you'd like to read. Approved suggestions feed our title research and may become real ebooks.
            </p>
          </div>
          {!open && (
            <Button variant="outline" className="border-primary/40 shrink-0" onClick={() => setOpen(true)} data-testid="button-suggest-book">
              Suggest a Book
            </Button>
          )}
        </div>
        {open && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3 max-w-xl">
            <Textarea
              placeholder="Describe the book you'd love to see — genre, topic, or story idea..."
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              maxLength={2000}
              className="bg-black/40 border-white/10 min-h-[100px]"
              data-testid="input-book-request"
            />
            <Input
              type="email"
              placeholder="Email (optional — we'll notify you if we make it)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/40 border-white/10"
              data-testid="input-book-request-email"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting || !requestText.trim()} data-testid="button-submit-book-request">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Suggestion"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
