import { Footer } from "@/components/layout/footer";
import { Link } from "wouter";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Link href="/" className="text-primary hover:underline text-sm font-serif mb-6 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-display text-white mb-2">Cookie Policy</h1>
        <p className="text-muted-foreground text-sm font-serif mb-8">
          Last updated: June 1, 2025 &bull; Applies to: ebookgamez.com
        </p>

        <div className="prose prose-invert prose-sm max-w-none font-serif space-y-6 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-xl font-display text-white">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device when you visit a website. They allow the site to remember your preferences, keep you logged in, measure traffic, and deliver relevant advertising. Cookies do not contain personally identifiable information on their own, but they can be combined with other data to identify you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">2. Who We Are</h2>
            <p>
              EbookGamez ("we," "us," or "our") operates the website at <strong className="text-white">ebookgamez.com</strong>. We are a digital retailer offering AI-assisted ebooks and curated HTML5 games. Our business address is P.O. Box 1181, Las Vegas, NV 89125. Questions about this policy can be directed to <a href="mailto:ebookgames@yahoo.com" className="text-primary hover:underline">ebookgames@yahoo.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">3. Types of Cookies We Use</h2>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">3.1 Strictly Necessary Cookies</h3>
            <p>
              These cookies are essential for the website to function and cannot be disabled. They support session management, your shopping cart, secure checkout via Stripe, and user account authentication.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Session cookie</strong> — keeps you logged in during your visit.</li>
              <li><strong className="text-white">Cart cookie</strong> — preserves items in your cart.</li>
              <li><strong className="text-white">CSRF token</strong> — protects form submissions from cross-site request forgery.</li>
              <li><strong className="text-white">Cookie consent state</strong> — remembers whether you have accepted or declined optional cookies.</li>
            </ul>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">3.2 Analytics Cookies</h3>
            <p>
              We use Google Analytics 4 (GA4) to understand how visitors interact with our site. GA4 collects anonymized data such as pages visited, time on site, device type, and approximate geographic location (country/region level). No personally identifiable information is stored in GA4.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">_ga</strong> — Google Analytics client identifier (expires 2 years).</li>
              <li><strong className="text-white">_ga_*</strong> — Google Analytics session state (expires 2 years).</li>
            </ul>
            <p>
              You can opt out of GA4 by installing the{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Google Analytics opt-out browser add-on
              </a>.
            </p>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">3.3 Advertising Cookies</h3>
            <p>
              We work with advertising partners to display relevant ads and measure campaign performance. These cookies may track your browsing activity across websites to serve interest-based advertising.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-white">Google Ads (Conversion Tracking)</strong> — records purchase conversions when you click a Google ad and complete a transaction. Set by google.com and doubleclick.net.
              </li>
              <li>
                <strong className="text-white">Google Ads Remarketing</strong> — allows Google to show EbookGamez ads to past visitors on other sites and Google properties.
              </li>
            </ul>
            <p>
              You can manage Google advertising preferences at{" "}
              <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                adssettings.google.com
              </a>.
            </p>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">3.4 Third-Party Service Cookies</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Stripe</strong> — our payment processor sets cookies during checkout to prevent fraud and maintain payment session state. See{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Privacy Policy</a>.
              </li>
              <li>
                <strong className="text-white">GameDistribution</strong> — our HTML5 games are served through GameDistribution. When you play a game, GameDistribution may set cookies to serve in-game ads and measure ad performance. See{" "}
                <a href="https://gamedistribution.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GameDistribution's Privacy Policy</a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">4. Content Licensing &amp; Safety</h2>
            <p>
              All ebooks available on EbookGamez are original works created with AI assistance and reviewed by our editorial team before publication. Games are served through GameDistribution's licensed catalog of HTML5 titles. We do not host, distribute, or link to pirated, unlicensed, or illegal content of any kind.
            </p>
            <p>
              Downloads (PDFs/EPUBs) are original digital products sold directly to verified customers via Stripe. File delivery is performed over HTTPS with authenticated download links.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">5. How to Control Cookies</h2>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">5.1 Cookie Consent Banner</h3>
            <p>
              When you first visit EbookGamez, we display a cookie consent banner. You may accept all cookies or select "Essential Only" to decline analytics and advertising cookies. You can change your selection at any time by clearing your browser cookies and revisiting the site.
            </p>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">5.2 Browser Settings</h3>
            <p>Most browsers allow you to block or delete cookies. Note that disabling essential cookies will prevent checkout and account features from working correctly.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Firefox</a></li>
              <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
            </ul>

            <h3 className="text-base font-semibold text-white/80 mt-4 mb-2">5.3 Opt-Out Links</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Digital Advertising Alliance (DAA) opt-out
                </a>
              </li>
              <li>
                <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Network Advertising Initiative (NAI) opt-out
                </a>
              </li>
              <li>
                <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  European Interactive Digital Advertising Alliance (EDAA) — for EU users
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">6. Do Not Track</h2>
            <p>
              Some browsers include a "Do Not Track" (DNT) signal. Our site currently does not alter its behavior in response to DNT signals, as there is no industry-standard interpretation. We rely on your cookie consent selection made through our consent banner instead.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">7. Children's Privacy</h2>
            <p>
              EbookGamez is not directed to children under 13. We do not knowingly collect personal data from children. If you believe a child has provided personal data through our site, please contact us at <a href="mailto:ebookgames@yahoo.com" className="text-primary hover:underline">ebookgames@yahoo.com</a> and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">8. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy periodically to reflect changes in technology, regulation, or our services. The "Last updated" date at the top of this page indicates when it was most recently revised. Continued use of the site after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display text-white">9. Contact Us</h2>
            <p>
              For questions about this Cookie Policy or our data practices, please contact:
            </p>
            <address className="not-italic text-white/70 mt-2 space-y-0.5">
              <p><strong className="text-white">EbookGamez</strong></p>
              <p>P.O. Box 1181</p>
              <p>Las Vegas, NV 89125</p>
              <p><a href="mailto:ebookgames@yahoo.com" className="text-primary hover:underline">ebookgames@yahoo.com</a></p>
            </address>
            <p className="mt-3">
              For general inquiries, you may also use our{" "}
              <Link href="/contact" className="text-primary hover:underline">Contact page</Link>.
            </p>
          </section>

          <div className="border-t border-white/10 pt-6 mt-8">
            <p className="text-xs text-white/30">
              Related policies:{" "}
              <Link href="/privacy-policy" className="text-primary/70 hover:text-primary">Privacy Policy</Link>
              {" · "}
              <Link href="/terms-of-service" className="text-primary/70 hover:text-primary">Terms of Service</Link>
              {" · "}
              <Link href="/refund-policy" className="text-primary/70 hover:text-primary">Refund Policy</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
