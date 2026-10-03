import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import CTASection from "@/components/CTASection";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import { 
  Shield,
  UserCheck,
  Clock,
  Heart,
  MessageCircle
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import nannyHeroImage from "@/assets/hero/nanny-hero.jpg";
import earlyLearningImage from "@/assets/services/nanny-early-learning.jpg";
import afterSchoolImage from "@/assets/services/nanny-after-school.jpg";
import infantToddlerImage from "@/assets/services/nanny-infant-toddler.jpg";
import householdImage from "@/assets/services/nanny-household.jpg";
import parentWorkshopsImage from "@/assets/services/nanny-parent-workshops.jpg";

const NannyChildcare = () => {
  const services = [
    {
      title: "Early Learning Programs",
      description: "Age-appropriate activities that support cognitive, social, and motor development through play-based learning.",
      href: "/nanny-childcare",
      image: earlyLearningImage,
    },
    {
      title: "After-School Care",
      description: "Pickup, homework support, snacks, and supervised activities until you're home from work.",
      href: "/nanny-childcare",
      image: afterSchoolImage,
    },
    {
      title: "Infant & Toddler Care",
      description: "Specialized care for your youngest ones: feeding, nap routines, and diaper changes with CPR-certified caregivers.",
      href: "/nanny-childcare",
      image: infantToddlerImage,
    },
    {
      title: "Household Assistance",
      description: "Light housekeeping related to childcare, including tidying play areas, children's laundry, and meal prep for kids.",
      href: "/nanny-childcare",
      image: householdImage,
    },
    {
      title: "Parent Workshops",
      description: "Guidance on child development, positive discipline, nutrition, and parenting resources.",
      href: "/nanny-childcare",
      image: parentWorkshopsImage,
    },
  ];

  const whoWeHelp = [
    "Working parents needing reliable daily care",
    "Families seeking part-time or flexible support",
    "Parents returning to work after parental leave",
    "Families with multiple children",
    "Parents needing backup care for emergencies",
  ];

  const caregiverQualities = [
    "Background checked and verified",
    "Trained in child development and safety",
    "Infant and child CPR certified",
    "Experienced with various age groups",
    "Supported by ongoing training and supervision",
  ];

  const benefits = [
    {
      title: "Vetted & Trusted",
      description: "Rigorous screening for every caregiver",
      icon: Shield,
    },
    {
      title: "Flexible Arrangements",
      description: "Full-time, part-time, or backup care",
      icon: Clock,
    },
    {
      title: "Family-Centered",
      description: "We match based on your values and parenting style",
      icon: Heart,
    },
    {
      title: "Ongoing Support",
      description: "We stay involved to ensure quality and address concerns",
      icon: UserCheck,
    },
  ];

  const steps = [
    { title: "Get in Touch", description: "Share your family's needs: ages of children, schedule, any special requirements." },
    { title: "Consultation", description: "We discuss your expectations and preferences in detail." },
    { title: "Meet Your Nanny", description: "We introduce you to matched candidates. You choose the right fit for your family." },
    { title: "Care Begins", description: "Your nanny starts, with ongoing support and check-ins from our team." },
  ];

  const nannyFaqs = [
    { q: "How much does a nanny cost in Lagos?", a: "Vetted, insured nannies start from ₦25,000 per day (day nanny) and ₦120,000 per week (live-in), depending on hours and child age. Every engagement begins with a one-off ₦35,000 Initial Home Assessment that covers the home visit, matching and onboarding." },
    { q: "Are your nannies trained and background-checked?", a: "Yes. Every nanny is vetted with police clearance, reference checks, infant CPR certification, and a Medic Connect interview before placement. We carry professional indemnity insurance on all placements." },
    { q: "Do you offer live-in or live-out nannies?", a: "Both. We match live-in nannies for families needing overnight cover and live-out nannies for daytime care. Schedules are agreed in writing during your assessment." },
    { q: "How quickly can a nanny start?", a: "Most nanny placements in Lagos are confirmed within 48 hours of your assessment, depending on requirements and availability." },
  ];
  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Trained Nannies in Lagos from ₦25,000/day | Vetted & Insured | Medic Connect" description="Trained nannies in Lagos, vetted with police clearance, infant CPR and references. Day nannies from ₦25,000, live-in from ₦120,000/week." path="/nanny-childcare" jsonLd={[{"@context":"https://schema.org","@type":"Service","name":"Nanny & Childcare","serviceType":"Childcare","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Trained, vetted and insured nannies matched to your family across Lagos.","url":"https://www.medicconnect.co/nanny-childcare","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"25000","highPrice":"120000","offerCount":"4","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Day nanny from ₦25,000 per day. Live-in nanny from ₦120,000 per week. Night nanny from ₦35,000 per night."}}},{"@context":"https://schema.org","@type":"FAQPage","mainEntity":nannyFaqs.map(f=>({"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}}))}]} />
      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={nannyHeroImage}
                alt="Nanny playing with children"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="flex flex-col justify-center space-y-5 md:space-y-7">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-navy w-fit animate-fade-in">
                Nanny & childcare
              </span>
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  The calibre of care you'd choose if you could choose anyone.
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg md:text-xl leading-relaxed max-w-xl animate-slide-up stagger-1">
                  Most candidates don't make it past our checks. The ones who do are warm, trained, and the kind of person you'd want raising your child with you.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="https://wa.me/2348126988237?text=Hi%20Medic%20Connect%2C%20I%27d%20like%20to%20find%20a%20nanny." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Chat on WhatsApp
                  </a>
                </Button>
                <CareRequestDialog
            serviceLineKey="nanny_childcare"
            source="hero:nanny_childcare"
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

        {/* Vetting-as-scarcity + rematch guarantee */}
        <section className="py-10 md:py-12">
          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            <div className="kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
              <h3 className="font-bold text-lg mb-3">Most don't make it through</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                Background checks, address verification, guarantor, training, CPR. We only present nannies we'd put with our own children.
              </p>
            </div>
            <div className="kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up stagger-1">
              <h3 className="font-bold text-lg mb-3">Rematch, no awkwardness</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                If the fit isn't right, we replace, quickly and quietly. Comfort and trust matter more than continuity for its own sake.
              </p>
            </div>
            <div className="kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up stagger-2">
              <h3 className="font-bold text-lg mb-3">Outcomes, not just hours</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                A calmer house, a more confident child, parents who actually get to rest. That's the brief, and the brief we're judged on.
              </p>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="py-10 md:py-12">
          <div className="max-w-4xl mx-auto text-center animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-6">About Our Service</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We provide professional nanny and home care services tailored to each family. Our caregivers support children with love and attention while giving parents peace of mind. Flexible care on your terms, with the reassurance that your child is cared for in a familiar home environment.
            </p>
          </div>
        </section>

        {/* Our Services - Flip Cards */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink">Our Services</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <div key={service.title} className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                <ServiceFlipCard {...service} />
              </div>
            ))}
          </div>
        </section>

        {/* Our Clients */}
        <ClientsScrollSection clients={whoWeHelp} />

        {/* Our Caregivers */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-muted p-8 md:p-12 animate-slide-up">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Our Caregivers</h2>
              <p className="text-muted-foreground mb-8">All nannies and childcare providers are:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {caregiverQualities.map((quality) => (
                  <div key={quality} className="flex items-center gap-3 p-4 rounded-xl bg-card hover:scale-[1.02] transition-transform">
                    <UserCheck className="w-5 h-5 text-accent flex-shrink-0" />
                    <span className="text-sm font-medium">{quality}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">How It Works</h2>
          </div>

          <div className="max-w-2xl mx-auto kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
            <Accordion type="single" collapsible defaultValue="step-0">
              {steps.map((step, index) => (
                <AccordionItem key={index} value={`step-${index}`} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-lg">{step.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pl-13 pb-4">
                    {step.description}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* SEO content + FAQ */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card border border-border/50 p-6 md:p-10 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Trained Nannies in Lagos — Vetted, Insured, Background-Checked</h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-8 max-w-3xl">
              Every nanny we place in Lagos is interviewed by Medic Connect, police-vetted, reference-checked, and infant-CPR certified. We carry professional indemnity insurance on every placement and supervise the relationship for the first 90 days. Families on the Island and mainland book us for early-years care, after-school cover, and live-in support.
            </p>
            <div className="max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
                {nannyFaqs.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
                    <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>




        {/* CTA Section */}
        <CTASection 
          headline="Give your children the care they deserve."
          body="Let's find the right nanny for your family."
          secondaryButton={{ text: "Get Started", href: "/contact" }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default NannyChildcare;
