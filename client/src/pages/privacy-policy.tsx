import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-8 text-center" data-testid="text-privacy-title">Privacy Policy</h1>

          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-6">
            <p className="text-sm text-white/50">Last updated: April 30, 2026</p>

            <h2 className="text-2xl font-display text-white mt-8">1. Introduction</h2>
            <p>
              EbookGamez ("we", "us", or "our") operates the EbookGamez website. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, play games, or make purchases.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">2. Information We Collect</h2>
            <p>We may collect information about you in a variety of ways, including:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li><strong className="text-white">Personal Data:</strong> Name, email address, and payment information you voluntarily provide when making a purchase or contacting us.</li>
              <li><strong className="text-white">Usage Data:</strong> Information about how you access and use our website, including your IP address, browser type, device type, operating system, pages visited, referring URLs, and time spent on pages.</li>
              <li><strong className="text-white">Cookies and Tracking Technologies:</strong> We use cookies, web beacons, pixel tags, and similar tracking technologies to collect information about your browsing activity. See Section 4 for details.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">3. Advertising and Tracking</h2>
            <p>
              We work with third-party advertising partners to display ads on our website and to measure the effectiveness of our advertising campaigns. These partners may use cookies and similar technologies to collect information about your browsing activity.
            </p>
            <h3 className="text-xl font-display text-white/90 mt-6">Google Tag Manager</h3>
            <p>
              We use Google Tag Manager (GTM) to manage and deploy tracking tags on our website. GTM itself does not collect personal data, but it loads other tags — including Google Analytics 4 and Google Ads conversion tracking — that may collect usage and behavioral data as described below.
            </p>
            <h3 className="text-xl font-display text-white/90 mt-6">Google Analytics 4</h3>
            <p>
              We use Google Analytics 4 (GA4) to understand how visitors use our website. GA4 collects data such as pages visited, time on site, device type, and general location (country/region level). This data is processed by Google and used to generate aggregated reports. GA4 uses cookies and similar technologies to identify returning visitors. You can opt out of GA4 tracking by installing the{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Analytics opt-out browser add-on</a>.
            </p>
            <h3 className="text-xl font-display text-white/90 mt-6">Google Ads Conversion Tracking</h3>
            <p>
              We use Google Ads conversion tracking to measure the effectiveness of our advertising campaigns. When you click a Google ad and complete an action on our site (such as making a purchase or signing up for a subscription), a cookie is set to record that conversion. This helps us understand which ads are driving results. Google may use this data in accordance with its own privacy policy.
            </p>
            <p>
              You can opt out of personalized advertising by visiting{" "}
              <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Ads Settings</a>{" "}
              or the{" "}
              <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Network Advertising Initiative opt-out page</a>.
            </p>
            <h3 className="text-xl font-display text-white/90 mt-6">GameDistribution</h3>
            <p>
              Our Play Games section uses GameDistribution to serve HTML5 games. GameDistribution may use cookies and tracking technologies to serve ads within games and to measure ad performance. By playing games on our website, you acknowledge that GameDistribution may collect data in accordance with their privacy policy.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">4. Cookies</h2>
            <p>We use the following types of cookies:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li><strong className="text-white">Essential Cookies:</strong> Required for the website to function properly, including session management, shopping cart functionality, and security features. These cannot be disabled.</li>
              <li><strong className="text-white">Analytics Cookies:</strong> Help us understand how visitors interact with our website by collecting and reporting usage data anonymously.</li>
              <li><strong className="text-white">Advertising Cookies:</strong> Used by our advertising partners (Google) to serve relevant advertisements and measure ad campaign effectiveness. These cookies may track your browsing activity across websites.</li>
              <li><strong className="text-white">Third-Party Cookies:</strong> Set by third-party services embedded in our pages, such as GameDistribution (for games) and Stripe (for payment processing).</li>
            </ul>
            <p>
              You can manage your cookie preferences through our cookie consent banner or your browser settings. Disabling certain cookies may affect the functionality of our website. You may also opt out of interest-based advertising through the{" "}
              <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Digital Advertising Alliance</a>.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">5. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Process transactions and deliver purchased ebooks electronically.</li>
              <li>Provide customer support and respond to inquiries.</li>
              <li>Improve our website, products, and user experience.</li>
              <li>Send marketing communications (with your consent).</li>
              <li>Measure the effectiveness of our advertising campaigns.</li>
              <li>Prevent fraud and ensure the security of our platform.</li>
              <li>Comply with legal obligations.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">6. Third-Party Services</h2>
            <p>
              We may share your information with third-party service providers that assist us in operating our website, conducting our business, or serving you. These include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li><strong className="text-white">Stripe:</strong> For secure payment processing. Stripe's privacy policy can be found at <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">stripe.com/privacy</a>.</li>
              <li><strong className="text-white">Google Tag Manager:</strong> For managing and deploying tracking tags on our website.</li>
              <li><strong className="text-white">Google Analytics 4:</strong> For website analytics and usage reporting. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google's Privacy Policy</a>.</li>
              <li><strong className="text-white">Google Ads:</strong> For advertising services and conversion tracking to measure ad campaign effectiveness.</li>
              <li><strong className="text-white">GameDistribution:</strong> For HTML5 game delivery and in-game advertising.</li>
            </ul>
            <p>
              We do not sell your personal information to third parties. Information shared with advertising partners is used solely for the purposes described in this policy.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">7. Data Retention</h2>
            <p>
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law. Purchase records are retained for accounting and tax purposes as required by applicable law.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">8. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information, including encryption of payment data through Stripe. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">9. Your Rights</h2>
            <h3 className="text-xl font-display text-white/90 mt-6">For All Users</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Opt out of marketing communications at any time.</li>
              <li>Manage cookie preferences through your browser settings.</li>
              <li>Request information about the data we hold about you.</li>
            </ul>
            <h3 className="text-xl font-display text-white/90 mt-6">For EEA/UK Users (GDPR)</h3>
            <p>If you are located in the European Economic Area or United Kingdom, you additionally have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Access, correct, or delete your personal data.</li>
              <li>Object to or restrict processing of your data.</li>
              <li>Data portability.</li>
              <li>Withdraw consent at any time.</li>
              <li>Lodge a complaint with your local data protection authority.</li>
            </ul>
            <h3 className="text-xl font-display text-white/90 mt-6">For California Residents (CCPA)</h3>
            <p>California residents have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Know what personal information is being collected.</li>
              <li>Know whether personal information is sold or disclosed and to whom.</li>
              <li>Request deletion of personal information.</li>
              <li>Not be discriminated against for exercising these rights.</li>
            </ul>
            <p>To exercise any of these rights, <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">contact our support team</a>.</p>

            <h2 className="text-2xl font-display text-white mt-8">10. Children's Privacy</h2>
            <p>
              Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. The games available on our platform are intended for general audiences. If you believe we have inadvertently collected information from a child under 13, please contact us immediately and we will take steps to delete such information.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We take steps to ensure that your information receives adequate protection in accordance with this policy.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact us at:
              <br />
              <strong className="text-white">Email:</strong>{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">ebookgames@yahoo.com</a>
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
