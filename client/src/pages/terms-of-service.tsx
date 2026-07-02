import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <Navbar />

      <div className="container mx-auto px-4 py-32 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-8 text-center" data-testid="text-terms-title">Terms of Service</h1>

          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-6">
            <p className="text-sm text-white/50">Last updated: March 11, 2026</p>

            <h2 className="text-2xl font-display text-white mt-8">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the EbookGamez website, you accept and agree to be bound by these Terms of Service and our{" "}
              <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>. If you do not agree to these terms, please do not use our website.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">2. Eligibility</h2>
            <p>
              You must be at least 13 years of age to use this website. By using our website, you represent and warrant that you are at least 13 years old. If you are under 18, you must have the consent of a parent or legal guardian to use this website and make purchases.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">3. Description of Service</h2>
            <p>
              EbookGamez is a digital platform that provides:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li><strong className="text-white">Ebook Store:</strong> A curated collection of digital ebooks available for purchase and instant download.</li>
              <li><strong className="text-white">Play Games:</strong> Free-to-play HTML5 games powered by GameDistribution, supported by advertising.</li>
              <li><strong className="text-white">Download Hub:</strong> Links to official download pages for popular games and software.</li>
              <li><strong className="text-white">Gaming Guides:</strong> Strategy guides, tips, and informational content for popular games.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">4. Digital Products and Delivery</h2>
            <p>
              All ebooks sold on EbookGamez are digital goods delivered electronically. Upon successful payment:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>You will receive immediate access to download your purchased ebook(s).</li>
              <li>No physical products are shipped. All delivery is instant and electronic.</li>
              <li>You are granted a personal, non-transferable, non-exclusive license to use the purchased ebook for personal, non-commercial purposes.</li>
              <li>Redistribution, resale, public display, or sharing of purchased ebooks is prohibited.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">5. Pricing and Payment</h2>
            <p>
              All prices are displayed in United States Dollars (USD). Prices are subject to change without notice, but changes will not affect orders already placed. Payment is processed securely through Stripe. We do not store your payment card details on our servers. All payment information is handled directly by Stripe in compliance with PCI DSS standards.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">6. Refund Policy</h2>
            <p>
              Due to the digital nature of our products, all sales are generally considered final. However, we do offer refunds in certain circumstances, including duplicate charges, technical issues, and unauthorized transactions. For full details, please see our{" "}
              <a href="/refund-policy" className="text-primary underline">Refund Policy</a>.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">7. Games and Third-Party Content</h2>
            <p>
              Games available on our platform are provided by third-party developers through GameDistribution. These games may contain advertising. We do not control the content or ads displayed within third-party games. The Download Hub provides links to official external websites; we are not responsible for the content, terms, or practices of linked third-party sites.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">8. Advertising</h2>
            <p>
              Our website displays advertisements from third-party advertising networks including Google Ads. By using our website, you acknowledge that ads may be displayed and that advertising partners may use cookies and tracking technologies as described in our{" "}
              <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">9. Intellectual Property</h2>
            <p>
              All content on this website, including but not limited to text, graphics, logos, cover artwork, ebook content, and guide articles, is the property of EbookGamez or its content creators and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works from any content without our express written permission.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">10. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Use the website for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to any part of the website.</li>
              <li>Reproduce, duplicate, copy, sell, or exploit any portion of the website without express permission.</li>
              <li>Use automated tools to scrape, crawl, or download content from the website.</li>
              <li>Interfere with or disrupt the website or its infrastructure.</li>
              <li>Misrepresent your identity or affiliation with any person or entity.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">11. Disclaimer of Warranties</h2>
            <p>
              The website and all products are provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the website will be uninterrupted, error-free, or free of viruses.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">12. Limitation of Liability</h2>
            <p>
              In no event shall EbookGamez, its owners, employees, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the website or purchase of products, even if we have been advised of the possibility of such damages.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">13. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless EbookGamez and its owners, employees, and affiliates from any claims, liabilities, damages, or expenses arising from your use of the website or violation of these terms.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">14. Modifications</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately upon posting to the website. Your continued use of the website after changes are posted constitutes acceptance of the updated terms. We encourage you to review these terms periodically.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">15. Governing Law</h2>
            <p>
              These Terms of Service shall be governed by and construed in accordance with the laws of the United States. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts in the United States.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">16. Severability</h2>
            <p>
              If any provision of these Terms of Service is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that the remaining provisions shall remain in full force and effect.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">17. Contact</h2>
            <p>
              For questions regarding these Terms of Service, contact us at:
              <br />
              <strong className="text-white">Email:</strong>{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">Email Support</a>
              <br />
              <strong className="text-white">Mailing Address:</strong>{" "}
              P.O. Box 1181, Las Vegas, NV 89125
              <br />
              <strong className="text-white">Website:</strong>{" "}
              <a href="/contact" className="text-primary underline">Contact Page</a>
            </p>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
