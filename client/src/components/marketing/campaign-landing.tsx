import { Link } from "wouter";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

type CampaignLandingProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  benefits: string[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  children?: React.ReactNode;
};

export function CampaignLanding({
  eyebrow,
  title,
  description,
  icon: Icon,
  benefits,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  children,
}: CampaignLandingProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-white/10 py-24 md:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,169,113,0.18),transparent_55%)]" />
          <div className="container relative mx-auto max-w-5xl px-4 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-4 font-display text-xs uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
            <h1 className="mx-auto max-w-4xl font-display text-4xl leading-tight text-white md:text-6xl">{title}</h1>
            <p className="mx-auto mt-6 max-w-2xl font-serif text-lg leading-relaxed text-white/65">{description}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={primaryHref}>
                <Button size="lg" className="gap-2 px-8 font-display">
                  {primaryLabel} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={secondaryHref}>
                <Button size="lg" variant="outline" className="border-white/20 px-8 font-display text-white hover:bg-white/5">
                  {secondaryLabel}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="grid gap-5 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Check className="h-4 w-4 text-primary" />
                  </span>
                  <p className="font-serif leading-relaxed text-white/70">{benefit}</p>
                </div>
              ))}
            </div>
            {children}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}