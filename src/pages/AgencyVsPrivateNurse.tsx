import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import { faqSchema, PROVIDER, LAGOS_AREA } from "@/lib/medical-schema";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MessageCircle, ShieldCheck, AlertTriangle, Scale } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import clinicalHeroImage from "@/assets/hero/clinical-hero.jpg";

const AgencyVsPrivateNurse = () => {
  const rows: Array<{ factor: string; agency: string; private: string }> = [
    { factor: "Vetting & background checks", agency: "Documented, repeated, insured", private: "Depends on the individual" },
    { factor: "Replacement if nurse falls sick", agency: "Yes, same day or next", private: "You restart the search" },
    { factor: "Supervision & clinical oversight", agency: "Care coordinator and clinical lead", private: "None" },
    { factor: "Insurance & liability cover", agency: "Carried by the agency", private: "Sits with the family" },
    { factor: "Training records", agency: "On file, refreshed regularly", private: "Self-reported" },
    { factor: "Pay & welfare", agency: "Above-market, transparent", private: "Negotiated each time" },
    { factor: "Cost (per shift)", agency: "Higher upfront, fewer hidden costs", private: "Lower upfront, more risk" },
    { factor: "Speed to start", agency: "Typically within 48 hours", private: "Days to weeks of searching" },
    { factor: "Diaspora booking", agency: "Yes, billed and reported abroad", private: "Hard to manage remotely" },
  ];

  const whenAgency = [
    "Post-surgical recovery or complex clinical needs",
    "A relative living alone or with cognitive decline",
    "Newborn care where overnight cover matters",
    "You are abroad and need accountability and reporting",
    "Insurance, documentation or HMO claims are involved",
  ];

  const whenPrivate = [
    "Light, predictable, non-clinical help",
    "You already have a trusted person from your network",
    "You can personally supervise day-to-day",
    "Budget is the single biggest constraint and risk is low",
  ];

  const faqs = [
    {
      q: "Is a nursing agency more expensive than a private nurse in Lagos?",
      a: "Per shift, yes, an agency usually costs more. Across the full engagement the gap narrows once you account for replacements, supervision, insurance, training and the time you spend managing it yourself. Most families who try both end up valuing the agency model for medium and high-risk cases."
    },
    {
      q: "Can I trust an agency nurse more than someone I find privately?",
      a: "Trust comes from process, not personality. An agency runs background checks, references, clinical screening, training records and ongoing supervision on every nurse it places. A private nurse may be excellent — but the burden of checking sits with you."
    },
    {
      q: "What happens if my nurse falls sick or doesn't turn up?",
      a: "With an agency like Medic Connect we send a vetted replacement, usually the same day. With a private hire, your care plan breaks and you start the search again."
    },
    {
      q: "I live abroad. Should I go agency or private for my parent in Lagos?",
      a: "From abroad, agency is almost always the right call. You need accountability, written reports, insurance and someone you can escalate to. A private nurse cannot give you any of that consistently."
    },
    {
      q: "How much does a nursing agency cost in Lagos?",
      a: "Medic Connect packages start from around ₦100,000 for short visits and run up to ₦300,000+ per week for live-in clinical care, depending on intensity, hours and location. Every engagement begins with a ₦35,000 care assessment so we scope and price honestly."
    },
    {
      q: "What questions should I ask before hiring any nurse in Lagos?",
      a: "Are you HEFAMAA accredited? Are you insured? Who supervises the nurse on shift? What happens if the nurse calls in sick? Can I see training and reference records? How do you handle medication errors or complications? An agency should answer all six in writing."
    },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Nursing Agency vs Private Nurse in Lagos: Cost, Risk & When to Use Each"
        description="Honest comparison of hiring a nursing agency vs a private nurse in Lagos. Cost, vetting, insurance, replacements and when each model is the right choice. Built by Medic Connect."
        path="/agency-vs-private-nurse-lagos"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Nursing Agency vs Private Nurse in Lagos",
            "description": "Side-by-side comparison of nursing agencies and private nurses in Lagos: vetting, cost, insurance, supervision and the right choice by care type.",
            "author": PROVIDER,
            "publisher": PROVIDER,
            "mainEntityOfPage": "https://www.medicconnect.co/agency-vs-private-nurse-lagos",
            "about": [
              { "@type": "Thing", "name": "Home nursing care in Lagos" },
              { "@type": "Thing", "name": "Private nurse hire Lagos" },
              { "@type": "Thing", "name": "Nursing agency Nigeria" },
            ],
            "areaServed": LAGOS_AREA,
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
              <img src={clinicalHeroImage} alt="Nurse caring for a patient at home in Lagos" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <span className="inline-block text-xs md:text-sm font-semibold tracking-wider uppercase text-accent-foreground bg-accent/30 rounded-full px-3 py-1 w-fit">
                Honest comparison
              </span>
              <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                Nursing agency vs private nurse in Lagos: which one is right?
              </h1>
              <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                Both can work. They fail for different reasons. Here is how to choose without learning the hard way.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="https://wa.me/2348126988237" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" /> Talk to our care team
                  </a>
                </Button>
                <CareRequestDialog
            source="hero:agencyvsprivatenurse"
            trigger={
              <Button variant="outline" className="rounded-full px-7 py-6 text-base font-medium border-2">
                Request care
              </Button>
            }
          />
              </div>
            </div>
          </div>
        </section>

        {/* TL;DR */}
        <section className="py-8">
          <div className="kit-curve-lg bg-card p-8 md:p-10 border border-hairline-warm max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-primary" />
              <h2 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.02em] text-ink">Short answer</h2>
            </div>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              For clinical needs, vulnerable relatives, newborns, post-surgical recovery, or any case you are managing
              from abroad, use a regulated <strong>nursing agency</strong>. For light, predictable, non-clinical help
              where you can personally supervise, a vetted <strong>private nurse</strong> can be cheaper. The deciding
              factor is risk, not price.
            </p>
          </div>
        </section>

        {/* Comparison table */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">Side by side</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Nine things families in Lagos ask about before they choose.</p>
          </div>
          <div className="kit-curve-lg bg-card border border-hairline-warm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Factor</TableHead>
                  <TableHead className="font-bold">Nursing agency (e.g. Medic Connect)</TableHead>
                  <TableHead className="font-bold">Private nurse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.factor}>
                    <TableCell className="font-medium">{r.factor}</TableCell>
                    <TableCell className="text-muted-foreground">{r.agency}</TableCell>
                    <TableCell className="text-muted-foreground">{r.private}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* When to use each */}
        <section className="py-10 md:py-12 grid md:grid-cols-2 gap-6 md:gap-8">
          <div className="kit-curve-lg bg-card p-8 border border-hairline-warm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold tracking-tight">When an agency is right</h3>
            </div>
            <ul className="space-y-3">
              {whenAgency.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="kit-curve-lg bg-card p-8 border border-hairline-warm">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold tracking-tight">When a private nurse may suit</h3>
            </div>
            <ul className="space-y-3">
              {whenPrivate.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-border/50 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                If insurance, documentation, or remote oversight matter — a private nurse is almost always the wrong call.
              </p>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">Common questions</h2>
          </div>
          <div className="max-w-3xl mx-auto kit-curve bg-card p-6 md:p-8 border border-hairline-warm">
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
          headline="Not sure which you need?"
          body="Tell us about the person you are caring for. We will give you an honest read in one conversation, even if the answer is not us."
        />
      </main>

      <Footer />
    </div>
  );
};

export default AgencyVsPrivateNurse;
