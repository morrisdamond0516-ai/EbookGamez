import { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { CampaignLanding } from "@/components/marketing/campaign-landing";

export default function ReadingPass() {
  useEffect(() => {
    document.title = "Reading Pass — Unlimited Ebook Access | EbookGamez";
  }, []);

  return (
    <CampaignLanding
      eyebrow="Read more for less"
      title="One Pass. A Whole Library of Stories."
      description="Explore the EbookGamez library with a Reading Pass built for readers who always want another book waiting."
      icon={BookOpen}
      benefits={[
        "Access hundreds of ebooks across fiction, learning, self-help, history, and more.",
        "Discover new releases and hidden gems without buying every title separately.",
        "Read online from your phone, tablet, or computer.",
        "Manage your subscription securely and cancel when you choose.",
      ]}
      primaryLabel="View Reading Pass Plans"
      primaryHref="/subscription"
      secondaryLabel="Browse the Catalog"
      secondaryHref="/catalog"
    />
  );
}