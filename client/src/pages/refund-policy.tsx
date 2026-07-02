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
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-8 text-center" data-testid="text-refund-title">Refund Policy</h1>

          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-6">
            <p className="text-sm text-white/50">Last updated: March 11, 2026</p>

            <h2 className="text-2xl font-display text-white mt-8">Overview</h2>
            <p>
              Thank you for purchasing from EbookGamez. We want you to be satisfied with your purchase. Please read our refund policy carefully before making a purchase.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">Digital Products</h2>
            <p>
              All products sold on EbookGamez are digital goods delivered electronically. Due to the nature of digital products, which can be accessed immediately upon purchase, all sales are generally considered final.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">Eligible Refund Situations</h2>
            <p>We will issue a refund in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li><strong className="text-white">Duplicate Charges:</strong> If you were charged more than once for the same product.</li>
              <li><strong className="text-white">Technical Issues:</strong> If you are unable to access or download the purchased ebook due to a technical problem on our end that we cannot resolve.</li>
              <li><strong className="text-white">Product Not as Described:</strong> If the product delivered is materially different from what was described on the product page at the time of purchase.</li>
              <li><strong className="text-white">Unauthorized Transactions:</strong> If a purchase was made without your authorization.</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">How to Request a Refund</h2>
            <p>
              To request a refund, please contact us within 14 days of your purchase at{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">our support email</a>{" "}
              with the following information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Your order confirmation or receipt</li>
              <li>The email address used for the purchase</li>
              <li>A description of the issue</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">Processing Time</h2>
            <p>
              Refund requests are reviewed within 5 business days. Approved refunds are processed back to the original payment method through Stripe. Please allow 5-10 business days for the refund to appear on your statement.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">Non-Refundable Situations</h2>
            <ul className="list-disc pl-6 space-y-2 text-white/80">
              <li>Change of mind after purchase</li>
              <li>Failure to read the product description before purchasing</li>
              <li>Incompatibility with your device (formats are listed on each product page)</li>
            </ul>

            <h2 className="text-2xl font-display text-white mt-8">Delivery Method</h2>
            <p>
              All ebooks are delivered digitally. Upon successful payment, you will receive immediate access to download your purchased ebooks. No physical products are shipped. Delivery is instant and electronic.
            </p>

            <h2 className="text-2xl font-display text-white mt-8">Contact Us</h2>
            <p>
              If you have any questions about our refund policy, please contact us at:
              <br />
              <strong className="text-white">Email:</strong>{" "}
              <a href="mailto:ebookgames@yahoo.com" className="text-primary underline">ebookgames@yahoo.com</a>
              <br />
              <strong className="text-white">Mailing Address:</strong>{" "}
              P.O. Box 1181, Las Vegas, NV 89125
            </p>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
