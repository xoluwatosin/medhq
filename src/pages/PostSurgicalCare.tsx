import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import { medicalServiceSchema, faqSchema } from "@/lib/medical-schema";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import { Activity, ClipboardCheck, Pill, ShieldCheck, HeartPulse, Footprints, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import postOperativeImage from "@/assets/services/post-operative.jpg";

const PostSurgicalCare = () => {
  const pillars = [{
    title: "Surgeon handoff",
    description: "We collect discharge notes, medication lists and follow-up dates from your surgeon, so nothing falls through the cracks between hospital and home.",
    icon: ClipboardCheck,
  }, {
    title: "Complications prevention",
    description: "Trained eyes on wound healing, signs of infection, blood clots and respiratory issues. Early flags, faster intervention.",
    icon: ShieldCheck,
  }, {
    title: "Medication timing",
    description: "Antibiotics, painkillers and blood thinners administered on schedule, with clear records you and your doctor can see.",
    icon: Pill,
  }, {
    title: "Wound and drain care",
    description: "Clean dressing changes, drain monitoring and stoma support delivered by qualified nurses following clinical protocols.",
    icon: Activity,
  }, {
    title: "Fall prevention",
    description: "Safe transfers, mobility support and home setup so recovery doesn't end with a second hospital visit.",
    icon: Footprints,
  }, {
    title: "Vitals and recovery review",
    description: "Daily vitals, pain scores and recovery notes shared with the family and, on request, with your treating doctor.",
    icon: HeartPulse,
  }];

  const conditions = [
    "After caesarean section",
    "After hysterectomy and gynae surgery",
    "After cardiac and stent procedures",
    "After joint replacement and orthopaedic surgery",
    "After cancer surgery and oncology recovery",
    "After abdominal and bariatric surgery",
    "After stroke and neurological events",
    "After paediatric surgery (with parents)",
  ];

  const faqs = [{
    q: "When should post-surgical home care start?",
    a: "Ideally before discharge. We can review the surgeon's plan, prep the home and meet you the day you come home. We can also start mid-recovery if you only realise later that more help is needed."
  }, {
    q: "What is the difference between this and clinical home care?",
    a: "Post-surgical care is a focused application of our clinical home care service: shorter, more intensive, organised around a specific procedure and recovery window."
  }, {
    q: "Can you coordinate with my surgeon or hospital?",
    a: "Yes. With your consent we liaise with your surgeon's team, share recovery notes and flag anything that needs medical review."
  }, {
    q: "Do you cover overnight cover after surgery?",
    a: "Yes. Overnight nursing cover is common for the first week or two after major surgery, especially when family caregivers also need to sleep."
  }, {
    q: "Can the patient's family abroad book this?",
    a: "Yes. Many of our post-surgical clients are booked by sons and daughters abroad. We send per-visit reports on WhatsApp and bill the family directly."
  }];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Post-Surgical Care at Home in Lagos | Medic Connect"
        description="Heal at home, safely. Trained nurses for wound care, medication timing, fall prevention and recovery monitoring after surgery. Lagos, typically within 48 hours."
        path="/post-surgical-care"
        jsonLd={[
          medicalServiceSchema({
            name: "Post-Surgical Home Care",
            path: "/post-surgical-care",
            description: "Skilled nursing for recovery at home after surgery: wound care, medication management, complications monitoring and fall prevention.",
            specialty: "Surgical",
            audienceType: "Patients recovering from surgery at home in Lagos",
            includeDiaspora: true,
            relatedProcedures: [
              "Surgical wound care and dressing changes",
              "Post-operative pain and medication management",
              "Drain and catheter care",
              "Complication and infection monitoring",
              "Mobility and fall-prevention support",
              "Post-Caesarean recovery care",
            ],
            offers: {
              lowPrice: 5000,
              highPrice: 250000,
              offerCount: 8,
              description: "From ₦5,000 per visit (wound care) to ₦250,000 for a Post-Caesarean Recovery package.",
            },
          }),
          faqSchema(faqs),
        ]}
      />

      <MedicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img src={postOperativeImage} alt="Nurse providing post-surgical care at home" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-navy w-fit animate-fade-in">
                Recovery at home
              </span>
              <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                Heal at home, safely, so your family doesn't have to carry it.
              </h1>
              <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                Trained nurses pick up where your surgeon leaves off. Wound care, medication timing, complications prevention and quiet eyes on your recovery, in your own bed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="https://wa.me/2348126988237" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
                  </a>
                </Button>
                <CareRequestDialog
            serviceLineKey="post_surgical"
            source="hero:post_surgical"
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

        {/* What we cover */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10 md:mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">What post-surgical care covers</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The clinical work that protects a clean recovery.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((p, i) => <HoverCard key={p.title} {...p} index={i} />)}
          </div>
        </section>

        {/* Conditions */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-border/50 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-8 text-center">Recoveries we support</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {conditions.map(item => (
                <div key={item} className="interactive-list-item">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-10 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-3">Common questions</h2>
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

        {/* Diaspora callout */}
        <section className="py-10 md:py-12">
          <a href="/care-from-abroad" className="block kit-curve-lg bg-card p-8 md:p-12 border border-border/50 hover:border-primary/40 transition-all animate-slide-up">
            <div className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center">
              <div>
                <span className="inline-block text-xs font-semibold tracking-wider uppercase text-accent-foreground bg-accent/30 rounded-full px-3 py-1 mb-4">For family abroad</span>
                <h3 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.02em] text-ink mb-3">Arranging recovery for a relative in Lagos from overseas?</h3>
                <p className="text-muted-foreground text-base md:text-lg">We book and bill from your side, deliver and report from ours. Per-visit WhatsApp updates so you sleep at night.</p>
              </div>
              <div className="text-primary font-semibold whitespace-nowrap">Care from Abroad →</div>
            </div>
          </a>
        </section>

        <CTASection
          headline="Bring them home, safely."
          body="Speak with our care team about post-surgical recovery in Lagos."
        />
      </main>

      <Footer />
    </div>
  );
};

export default PostSurgicalCare;
