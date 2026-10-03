import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import { medicalServiceSchema, faqSchema, DIASPORA_AUDIENCE, LAGOS_AREA, PROVIDER } from "@/lib/medical-schema";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, FileText, Calendar, CreditCard, ShieldCheck, HeartHandshake } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import eldercareHero from "@/assets/hero/eldercare-hero.jpg";

const CareFromAbroad = () => {
  const pillars = [{
    title: "You subscribe, we deliver",
    description: "You're the manager. We're the hands on the ground. Tell us what your loved one needs and we arrange the carer, the schedule, and the day-to-day.",
    icon: HeartHandshake,
  }, {
    title: "Per-visit reports on WhatsApp",
    description: "After every visit you get a short report: how mum slept, what she ate, vitals, mood, anything that needs your attention. No more guessing from 4,000 miles away.",
    icon: FileText,
  }, {
    title: "Scheduling across time zones",
    description: "Book, reschedule and message your care coordinator on WhatsApp. We work to your hours, not just Lagos hours.",
    icon: Calendar,
  }, {
    title: "Simple billing in your currency",
    description: "Pay by card or transfer from the UK, US, Canada, EU and beyond. Clear monthly invoices, no surprises.",
    icon: CreditCard,
  }, {
    title: "Vetted, insured carers",
    description: "Background checks, guarantor and address verification, licensing, training, HEFAMAA accreditation, insurance, and HFN membership. Every carer.",
    icon: ShieldCheck,
  }, {
    title: "48-hour placements",
    description: "When something changes suddenly, we move fast. Most placements are confirmed within 48 hours so you don't sit and worry.",
    icon: Clock,
  }];

  const useCases = [{
    title: "An ageing parent in Lagos",
    description: "Daily companion or skilled nursing visits with eldercare reports you can read on your commute.",
    href: "/eldercare",
  }, {
    title: "A sister who just gave birth",
    description: "Postnatal and Omugwo care delivered safely by trained nurses, when you can't fly home.",
    href: "/postnatal-care",
  }, {
    title: "A relative recovering from surgery",
    description: "Dedicated post-surgical nursing in the critical days after hospital discharge.",
    href: "/post-surgical-care",
  }, {
    title: "Chronic illness at home",
    description: "Skilled clinical home care: wound care, IV, medication management, 24-hour cover.",
    href: "/clinical-home-care",
  }];

  const faqs = [{
    q: "We live abroad. How do we actually arrange care for someone in Lagos?",
    a: "Message us on WhatsApp with a quick description of your loved one's situation. We do a phone or video consultation with you, then a home assessment in Lagos. Within 48 hours we usually have the right carer matched and starting."
  }, {
    q: "How do we know what's actually happening day to day?",
    a: "After every visit you get a short WhatsApp report covering vitals, meals, mood, medication and anything we noticed. You can also speak to the care coordinator any time."
  }, {
    q: "Can we pay from the UK, US or Canada?",
    a: "Yes. We accept card payments and international transfers. Invoices are issued monthly with clear line items."
  }, {
    q: "What if we want to change the carer?",
    a: "Just tell us. We re-match. Comfort and trust matter more than continuity for its own sake."
  }, {
    q: "Can the carer take our parent to hospital appointments?",
    a: "Yes. Escort to clinics and hospital appointments, with a written report afterwards, is a standard part of the service."
  }, {
    q: "Do you only serve Lagos?",
    a: "Right now, yes. Most of our diaspora clients have parents or relatives in Lagos. We're expanding carefully."
  }];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Care from Abroad — Arrange Care in Lagos for Your Loved Ones | Medic Connect"
        description="For diaspora families. Arrange vetted nurses and carers for parents and relatives in Lagos, with per-visit WhatsApp reports and simple international billing. Most placements within 48 hours."
        path="/care-from-abroad"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": ["Service", "MedicalBusiness"],
            "name": "Care from Abroad",
            "serviceType": "Diaspora-managed home care coordination",
            "provider": PROVIDER,
            "areaServed": LAGOS_AREA,
            "audience": [
              DIASPORA_AUDIENCE,
              {
                "@type": "MedicalAudience",
                "audienceType": "Elderly parents and relatives of Nigerians living abroad",
                "geographicArea": LAGOS_AREA,
              },
            ],
            "description": "Subscription-style home care for diaspora families: vetted nurses and carers in Lagos, per-visit WhatsApp reports, scheduling across time zones, international billing.",
            "url": "https://www.medicconnect.co/care-from-abroad",
            "availableChannel": {
              "@type": "ServiceChannel",
              "serviceUrl": "https://wa.me/2348126988237",
              "name": "WhatsApp care coordination",
            },
          },
          faqSchema(faqs),
        ]}
      />

      <MedicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img src={eldercareHero} alt="Family video call with elderly parent receiving home care in Lagos" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                Your hands at home in Lagos.
              </h1>
              <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                You can't be in two places. We can. From London, New York, Toronto or anywhere else, you manage the care for your loved one in Lagos and we deliver it, day by day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="https://wa.me/2348126988237?text=Hi%20Medic%20Connect%2C%20I%27m%20arranging%20care%20from%20abroad%20for%20a%20loved%20one%20in%20Lagos." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
                  </a>
                </Button>
                <CareRequestDialog
            serviceLineKey="care_from_abroad"
            source="hero:care_from_abroad"
            trigger={
              <Button variant="outline" className="kit-curve-sm border-[1.5px] border-outline-navy bg-transparent text-white hover:bg-hairline-navy px-7 py-6 text-base font-semibold">
                Request care
              </Button>
            }
          />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10 md:mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">How "care from abroad" works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              You set the standard. We hold the line on it, every visit.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((p, i) => <HoverCard key={p.title} {...p} index={i} />)}
          </div>
        </section>

        {/* Use cases */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-border/50 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3 text-center">Who diaspora families book us for</h2>
            <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">Tap the one closest to your situation.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {useCases.map(u => (
                <a key={u.title} href={u.href} className="block rounded-[1.5rem] bg-background p-6 border border-border/50 hover:border-primary/40 transition-all hover:scale-[1.02]">
                  <h3 className="font-semibold text-lg mb-2">{u.title}</h3>
                  <p className="text-sm text-muted-foreground">{u.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-muted/40 p-8 md:p-12 text-center animate-slide-up">
            <h2 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.02em] text-ink mb-4">You are not handing your parents to strangers.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Every Medic Connect carer is background-checked, address-verified, licensed and trained. We are HEFAMAA accredited, insured, members of the Healthcare Federation of Nigeria and partners of Flying Doctors Nigeria.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">Common questions from abroad</h2>
          </div>
          <div className="max-w-3xl mx-auto kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
            <Accordion type="single" collapsible defaultValue="faq-0">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-4 text-left font-semibold">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <CTASection
          headline="Stay the son. Stay the daughter."
          body="We'll be your hands at home in Lagos. Tell us about your loved one and we'll do the rest."
        />
      </main>

      <Footer />
    </div>
  );
};

export default CareFromAbroad;
