import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";

export default function Contact() {
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
          <h1 className="text-4xl md:text-5xl font-display text-primary mb-8 text-center" data-testid="text-contact-title">Contact Us</h1>

          <div className="prose prose-invert prose-lg mx-auto font-serif text-muted-foreground leading-relaxed space-y-6">
            <p className="text-center text-lg">
              We'd love to hear from you. Whether you have a question about our collection,
              need help with a purchase, or just want to say hello, feel free to reach out.
            </p>

            <div className="my-12 p-8 bg-white/5 border border-white/10 rounded-lg text-center">
              <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-display text-white mb-2">Email Us</h2>
              <a
                href="mailto:ebookgames@yahoo.com"
                className="text-primary text-xl underline hover:opacity-80 transition-opacity"
                data-testid="link-contact-email"
              >
                Send Us an Email
              </a>
              <p className="text-sm text-white/50 mt-4">We typically respond within 24-48 hours.</p>
            </div>

            <div className="my-12 p-8 bg-white/5 border border-white/10 rounded-lg text-center">
              <h2 className="text-2xl font-display text-white mb-2">Mailing Address</h2>
              <p className="text-muted-foreground font-serif">
                EbookGamez<br />
                P.O. Box 1181<br />
                Las Vegas, NV 89125
              </p>
            </div>

            <div className="my-12 p-8 bg-white/5 border border-white/10 rounded-lg">
              <h2 className="text-2xl font-display text-white mb-4 text-center">Common Inquiries</h2>
              <ul className="list-disc pl-6 space-y-3 text-white/80">
                <li><strong className="text-white">Purchase Issues:</strong> If you have trouble downloading an ebook, please include your order details in your email.</li>
                <li><strong className="text-white">Technical Support:</strong> For issues with ebook formats or compatibility, let us know your device and preferred reading app.</li>
                <li><strong className="text-white">General Questions:</strong> Questions about our collection, upcoming titles, or anything else — we're happy to help.</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
