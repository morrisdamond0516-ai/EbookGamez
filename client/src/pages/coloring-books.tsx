import { useEffect } from "react";
import { Palette } from "lucide-react";
import { CampaignLanding } from "@/components/marketing/campaign-landing";

export default function ColoringBooks() {
  useEffect(() => {
    document.title = "Printable Coloring Books | EbookGamez";
  }, []);

  return (
    <CampaignLanding
      eyebrow="Print, color, create"
      title="Printable Coloring Books for Creative Time"
      description="Discover downloadable coloring books for kids, classrooms, families, and anyone who wants a relaxing screen-free activity."
      icon={Palette}
      benefits={[
        "Downloadable digital books you can print at home.",
        "Creative themes for children, families, classrooms, and mindful downtime.",
        "Instant access after purchase—no shipping or waiting.",
        "Browse individual titles or explore the Reading Pass for more variety.",
      ]}
      primaryLabel="Browse All Coloring Books"
      primaryHref="/ebooks/coloring-books"
      secondaryLabel="Explore Reading Pass"
      secondaryHref="/reading-pass"
    />
  );
}