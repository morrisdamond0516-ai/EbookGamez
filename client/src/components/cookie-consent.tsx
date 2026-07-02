import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-card/95 backdrop-blur-md border-t border-white/10 p-4 md:p-6 shadow-2xl"
      data-testid="cookie-consent-banner"
    >
      <div className="container mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1 text-sm text-muted-foreground font-serif leading-relaxed">
          <p>
            We use cookies and similar technologies to enhance your experience, analyze site traffic, and serve relevant ads through Google AdSense and other advertising partners. We also use Google Tag Manager to manage analytics and marketing tags.
            By clicking "Accept All," you consent to the use of advertising and analytics cookies. If you decline, only essential cookies required for site functionality will be used.
            For more details, see our{" "}
            <Link href="/privacy-policy" className="text-primary underline hover:text-primary/80">
              Privacy Policy
            </Link>.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={decline}
            className="border-white/20 text-muted-foreground hover:text-white font-display text-xs"
            data-testid="button-cookie-decline"
          >
            Essential Only
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="bg-primary text-black hover:bg-primary/90 font-display text-xs"
            data-testid="button-cookie-accept"
          >
            Accept All
          </Button>
          <button
            onClick={decline}
            className="text-muted-foreground hover:text-white transition-colors ml-1"
            aria-label="Close cookie banner"
            data-testid="button-cookie-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
