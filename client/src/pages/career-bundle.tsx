import { useEffect } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { CampaignLanding } from "@/components/marketing/campaign-landing";

export default function CareerBundle() {
  useEffect(() => {
    document.title = "Career & Learning Ebook Collection | EbookGamez";
  }, []);

  return (
    <CampaignLanding
      eyebrow="Build your next chapter"
      title="Practical Reading for Career Growth"
      description="Find ebooks that help you sharpen useful skills, prepare for new opportunities, and keep learning at your own pace."
      icon={BriefcaseBusiness}
      benefits={[
        "Career, business, technology, and personal-development titles in one collection.",
        "Clear, practical reading you can return to whenever you need it.",
        "Instant digital access with secure Stripe checkout.",
        "Pair your reading with LearnForge for free AI-powered study support.",
      ]}
      primaryLabel="Browse Career Books"
      primaryHref="/ebooks/business"
      secondaryLabel="Try LearnForge"
      secondaryHref="/learnforge"
    />
  );
}