import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import HoverCard from "@/components/HoverCard";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  MessageCircle,
  Phone as PhoneIcon,
  Clock,
  MapPin,
  ShieldCheck,
  HeartPulse,
  Stethoscope,
  Heart,
  Baby,
  Home as HomeIcon,
} from "lucide-react";
import { getNeighbourhood } from "@/lib/neighbourhoods";
import { faqSchema, medicalServiceSchema } from "@/lib/medical-schema";
import clinicalHeroImage from "@/assets/hero/clinical-hero.jpg";

const NEED_ICONS = [HeartPulse, Heart, Stethoscope, Baby, HomeIcon, ShieldCheck];

interface NeighbourhoodCareProps {
  slug: string;
}

/**
 * Neighbourhood landing page template.
 *
 * Renders a traditional, locally-worded home care page for a single
 * Lagos area. Driven by config in src/lib/neighbourhoods.ts so each
 * page stays genuinely distinct (landmarks, hospitals, common needs)
 * without copy-pasting components.
 *
 * These pages are intentionally not linked from the main navigation —
 * they're discovered through local search.
 */
const NeighbourhoodCare = ({ slug }: NeighbourhoodCareProps) => {
  const n = getNeighbourhood(slug);
  if (!n) return null;

  const path = `/home-care-${n.slug}`;
  // Keep title ≤ 60 chars and description ≤ 160 chars across all neighbourhoods to avoid SERP truncation.
  const title = `Home Care in ${n.name} | Nurses 24/7`;
  const description = `Registered nurses and vetted caregivers in ${n.name}, Lagos. Post-surgical, elder, postnatal and paediatric care at home. HEFAMAA accredited.`;

  const needs = n.commonNeeds.map((c, i) => ({
    ...c,
    icon: NEED_ICONS[i % NEED_ICONS.length],
  }));

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title={title}
        description={description}
        path={path}
        jsonLd={[
          medicalServiceSchema({
            name: `Home Care in ${n.name}, Lagos`,
            path,
            description: `Skilled in-home nursing and caregiver services for families in ${n.name}, Lagos. Post-surgical recovery, eldercare, postnatal and paediatric care delivered at home by HEFAMAA-accredited Medic Connect.`,
            specialty: "Nursing",
            audienceType: `Families and patients in ${n.name}, Lagos`,
            includeDiaspora: true,
            relatedProcedures: [
              "Skilled nursing visits",
              "24-hour and live-in nursing",
              "Wound care and dressing changes",
              "Post-surgical recovery support",
              "Eldercare and companion care",
              "Postnatal and Omugwo care",
              "Paediatric home nursing",
            ],
            offers: {
              lowPrice: 5000,
              highPrice: 380000,
              offerCount: 9,
              description:
                "Nursing visits from ₦12,000. 24-hour nursing from ₦55,000 per day. Live-in caregivers from ₦12,000 per day. Initial home assessment ₦35,000.",
            },
          }),
          faqSchema(n.faqs),
        ]}
      />

      <MedicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={clinicalHeroImage}
                alt={`Home care nurse with patient in ${n.name}, Lagos`}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute top-6 left-6 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {n.name}, Lagos
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <span className="inline-block text-xs md:text-sm font-semibold tracking-wider uppercase text-accent-foreground bg-accent/30 rounded-full px-3 py-1 w-fit">
                {n.axis === "Island" ? "Lagos Island" : "Lagos Mainland"}
              </span>
              <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                Home Care in {n.name}, Lagos
              </h1>
              <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                {n.intro}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up stagger-2">
                <Button
                  asChild
                  className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity"
                >
                  <a
                    href="https://wa.me/2348126988237"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-7 py-6 text-base font-medium border-2"
                >
                  <a href="tel:+2348126988237" className="flex items-center gap-2">
                    <PhoneIcon className="w-5 h-5" /> Call now
                  </a>
                </Button>
              </div>
              <p className="text-sm text-muted-navy flex items-center gap-2">
                <Clock className="w-4 h-4" /> {n.responseLine}
              </p>
            </div>
          </div>
        </section>

        {/* Areas we cover */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-hairline-warm animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3 text-center">
              Areas we cover in {n.name}
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              Our nurses and caregivers regularly work across these
              {" "}{n.name} addresses and estates.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {n.landmarks.map((item) => (
                <div key={item} className="interactive-list-item">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Common needs */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10 md:mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">
              How families in {n.name} use us
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The most common reasons {n.name} households call.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {needs.map((need, i) => (
              <HoverCard
                key={need.title}
                title={need.title}
                description={need.description}
                icon={need.icon}
                index={i}
              />
            ))}
          </div>
        </section>

        {/* Hospitals we coordinate with */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-muted p-8 md:p-12 animate-slide-up">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <span className="inline-block text-xs font-semibold tracking-wider uppercase text-accent-foreground bg-accent/30 rounded-full px-3 py-1 mb-4">
                  Hospital-to-home
                </span>
                <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">
                  Hospitals near {n.name} we regularly coordinate with
                </h2>
                <p className="text-muted-foreground text-base md:text-lg">
                  With your consent, we collect discharge notes, medication
                  lists and follow-up dates so the first day at home is
                  not the day everything is figured out.
                </p>
              </div>
              <div className="space-y-3">
                {n.nearbyHospitals.map((h) => (
                  <div
                    key={h}
                    className="flex items-center gap-3 kit-curve-sm bg-card border border-hairline-warm p-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0">
                      <Stethoscope className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <span className="font-medium text-sm md:text-base">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-10 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "HEFAMAA accredited",
                description:
                  "Licensed and compliant with Lagos State health regulations.",
                icon: ShieldCheck,
              },
              {
                title: "Vetted nurses and caregivers",
                description:
                  "Background checks, license verification with the Nigerian Nursing Council and physical guarantors.",
                icon: HeartPulse,
              },
              {
                title: "24/7 cover",
                description:
                  "Visiting, overnight, 24-hour and live-in care arrangements available across " +
                  n.name +
                  ".",
                icon: Clock,
              },
            ].map((b, i) => (
              <HoverCard key={b.title} {...b} index={i} />
            ))}
          </div>
        </section>

        {/* Related services — internal linking */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-hairline-warm animate-slide-up">
            <h2 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.02em] text-ink mb-6 text-center">
              Related care in {n.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Clinical Home Care", href: "/clinical-home-care" },
                { label: "Post-Surgical Care", href: "/post-surgical-care" },
                { label: "Eldercare", href: "/eldercare" },
                { label: "Postnatal & Omugwo", href: "/postnatal-care" },
                { label: "Paediatric Care", href: "/pediatric-care" },
                { label: "Nanny & Childcare", href: "/nanny-childcare" },
                { label: "Antenatal Care", href: "/antenatal-care" },
                { label: "Care from Abroad", href: "/care-from-abroad" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="kit-curve-sm border border-hairline-warm bg-background p-4 text-center text-sm font-medium hover:border-primary/40 hover:bg-muted transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">
              Common questions from {n.name} families
            </h2>
          </div>
          <div className="max-w-3xl mx-auto kit-curve bg-card p-6 md:p-8 border border-hairline-warm animate-slide-up">
            <Accordion type="single" collapsible defaultValue="faq-0">
              {n.faqs.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border-border/50"
                >
                  <AccordionTrigger className="hover:no-underline py-4 text-left font-semibold">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <CTASection
          headline={`Need a nurse or caregiver in ${n.name} today?`}
          body="Speak with our care team on WhatsApp. We'll talk through your situation, recommend the right level of cover and confirm next steps."
        />
      </main>

      <Footer />
    </div>
  );
};

export default NeighbourhoodCare;
