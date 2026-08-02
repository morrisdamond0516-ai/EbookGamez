/**
 * Homepage FAQ for FAQPage JSON-LD (SEO / AI crawlers).
 */
export const HOME_FAQS: { question: string; answer: string }[] = [
  {
    question: "Do I need an account to read ebooks?",
    answer:
      "For classic (free) books, no account is needed — just click and read. For premium ebooks, purchase the book or use an active Reading Pass. Creating an account takes about 30 seconds and lets you access purchases from any device.",
  },
  {
    question: "What formats are the ebooks available in?",
    answer:
      "Our online reader works in any modern browser with no app required. Downloads are PDF files compatible with e-readers, tablets, and computers. Downloaded books are yours with no expiry date or DRM restrictions.",
  },
  {
    question: "How does the Reading Pass subscription work?",
    answer:
      "Choose a tier billed monthly or annually. You get unlimited online reading across the library plus monthly download credits that roll over (capped at your plan limit). Cancel anytime with no penalties. A free trial is available on select plans.",
  },
  {
    question: "Are the browser games really free?",
    answer:
      "Yes — every game in the Game Hub is free to play with no sign-up or payment. Games run in your browser and are ad-supported. New titles are added regularly across action, arcade, puzzle, racing, sports, and more.",
  },
  {
    question: "Is there a refund policy for ebook purchases?",
    answer:
      "Yes. We offer a 14-day refund window for purchases that don't meet your expectations. Contact support within 14 days with your order details for a full refund. Subscriptions can be cancelled anytime; access continues until the end of the billing period.",
  },
  {
    question: "Can I read on mobile and tablet?",
    answer:
      "Yes. The book reader is fully responsive on iPhone, Android, iPad, and laptop browsers. The layout adjusts to your screen automatically.",
  },
];

export function homeFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}
