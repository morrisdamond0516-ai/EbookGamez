import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";

export default function RefundPolicy() {
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
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-8 text-center" data-testid="text-refund-title">Refunds &amp; Cancellation Policy</h1>

          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-6">
            <p className="text-sm text-white/50">Last updated: August 10, 2026</p>

            <p>
              This policy explains how cancellations and refunds work for EbookGamez. It is part of our Terms of Service.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">1. How to Cancel</h2>
            <p>
              You can cancel a paid plan at any time from the billing portal in your account ("Manage billing"). When you cancel, future charges stop and you keep access until the end of the billing period you have already paid for. We do not automatically provide partial refunds for the unused part of a period.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">2. Subscription Refunds</h2>
            <p>
              Subscription charges are generally non-refundable once a billing period begins. As a courtesy, if you believe you were charged in error or have a special circumstance, contact us within 14 days of the charge and we will review your request in good faith. We always honor refunds required by applicable law.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">3. Annual Plans</h2>
            <p>
              Annual plans are billed once per year. If you cancel, you keep access for the remainder of the year you paid for, and the plan will not renew.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">4. Digital Products (Ebooks)</h2>
            <p>
              All ebooks sold on EbookGamez are digital goods delivered electronically. Due to the nature of digital products, which can be accessed immediately upon purchase, all sales are generally considered final. We will issue a refund in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li><strong className="text-white">Duplicate Charges:</strong> If you were charged more than once for the same product.</li>
              <li><strong className="text-white">Technical Issues:</strong> If you are unable to access or download the purchased ebook due to a technical problem on our end that we cannot resolve.</li>
              <li><strong className="text-white">Product Not as Described:</strong> If the product delivered is materially different from what was described on the product page at the time of purchase.</li>
              <li><strong className="text-white">Unauthorized Transactions:</strong> If a purchase was made without your authorization.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">5. How Payments and Receipts Work</h2>
            <p>All payments are processed securely by Stripe. Here is what happens in each situation and what to do:</p>
            <ul className="list-disc pl-6 space-y-3 text-white/80">
              <li><strong className="text-white">Payment went through.</strong> Stripe automatically emails you a receipt with your charge details and a direct link to view the transaction — no Stripe account required.</li>
              <li><strong className="text-white">No receipt received.</strong> Check your spam or junk folder first. If it is not there, the payment did not complete and nothing was charged. Try again or update your card in the billing portal inside your account.</li>
              <li><strong className="text-white">Payment failed or declined.</strong> Stripe sends you a payment-failed notification by email. Update your payment method from the billing portal inside your account, or email us and we will assist you.</li>
              <li><strong className="text-white">Unrecognised charge on your statement.</strong> Email us first — we can usually resolve it the same day. If we cannot resolve it to your satisfaction, your card-issuing bank can open a dispute (chargeback) on your behalf at no cost to you.</li>
              <li><strong className="text-white">Approved refunds.</strong> Once we approve a refund it is issued through Stripe and typically appears on your statement within 5–10 business days depending on your bank or card issuer.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">6. Failed, Duplicate, or Unauthorized Charges</h2>
            <p>
              Contact us immediately at{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">ebookgames@yahoo.com</a>{" "}
              and we will investigate and correct any genuine error promptly. You can also view every charge and invoice in the billing portal inside your account.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">7. How to Request a Refund</h2>
            <p>
              Email us at{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">ebookgames@yahoo.com</a>{" "}
              with the email address on your account, the date and amount of the charge, and a brief description of your request. We aim to respond within a few business days. Once approved, refunds are issued through Stripe and appear on your statement within 5–10 business days.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">8. Contact</h2>
            <p>
              <strong className="text-white">EbookGamez</strong><br />
              P.O. Box 1181, Las Vegas, NV 89125<br />
              <strong className="text-white">Email:</strong>{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">ebookgames@yahoo.com</a>
            </p>

            <p className="border-t border-white/10 pt-6 text-white/60 text-sm">
              After every payment you will automatically receive a receipt email with your charge details and a direct link to view them — no separate account needed. If you have any billing questions or need a refund, email us and we will handle everything on your behalf.
            </p>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
