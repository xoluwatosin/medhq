import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import HoverCard from "@/components/HoverCard";
import FlipCard from "@/components/FlipCard";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import { Building2, Stethoscope, Pill, Microscope, Activity, Clock, Shield, UserCheck, Zap, FileCheck, Headphones, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import hospitalStaffingHeroImage from "@/assets/hero/hospital-staffing-hero.jpg";
import temporaryStaffingImage from "@/assets/services/hospital-temporary-staffing.jpg";
import permanentPlacementsImage from "@/assets/services/hospital-permanent-placements.jpg";
import locumServicesImage from "@/assets/services/hospital-locum-services.jpg";
import eventMedicalImage from "@/assets/services/hospital-event-medical.jpg";

const HospitalStaffing = () => {
  const whoWeServe = ["Hospitals and clinics", "Diagnostic centers", "Nursing homes and care facilities", "Corporate organizations (occupational health)", "Event medical coverage"];
  const professionals = [{
    title: "Doctors",
    description: "General Practice & Specialists",
    icon: Stethoscope,
    backContent: "Access to experienced physicians for locum, permanent, or temporary positions across all specialties."
  }, {
    title: "Nurses",
    description: "RN, RM, Perioperative, ICU, etc.",
    icon: Activity,
    backContent: "Skilled nurses with specialized training and verified credentials for all hospital departments."
  }, {
    title: "Pharmacists",
    description: "Licensed pharmacy professionals",
    icon: Pill,
    backContent: "Qualified pharmacists for hospital pharmacies, clinics, and pharmaceutical facilities."
  }, {
    title: "Laboratory Scientists",
    description: "Qualified lab technicians",
    icon: Microscope,
    backContent: "Experienced lab professionals for diagnostic centers and hospital laboratories."
  }];
  const services = [{
    title: "Temporary Staffing",
    description: "Short-term cover for leave, sick days, or demand spikes with rapid deployment from our pre-vetted talent pool.",
    href: "/hospital-staffing",
    image: temporaryStaffingImage
  }, {
    title: "Permanent Placements",
    description: "Long-term recruitment support. We source, screen, and present qualified candidates for your permanent roles.",
    href: "/hospital-staffing",
    image: permanentPlacementsImage
  }, {
    title: "Locum Services",
    description: "Flexible locum arrangements for healthcare facilities needing reliable coverage without long-term commitment.",
    href: "/hospital-staffing",
    image: locumServicesImage
  }, {
    title: "Event Medical Staffing",
    description: "Qualified medical personnel for corporate events, sports events, conferences, and productions.",
    href: "/hospital-staffing",
    image: eventMedicalImage
  }];
  const benefits = [{
    title: "Pre-Vetted Talent",
    description: "Background checks, license verification, and skill assessments completed before deployment",
    icon: Shield
  }, {
    title: "Rapid Response",
    description: "Urgent requests prioritised, with agreed timelines confirmed at scoping",
    icon: Zap
  }, {
    title: "Compliance Managed",
    description: "We handle documentation, credentials, and regulatory requirements",
    icon: FileCheck
  }, {
    title: "Flexible Arrangements",
    description: "Scale up or down based on your needs",
    icon: Clock
  }, {
    title: "Dedicated Support",
    description: "Account management and 24/7 coordination",
    icon: Headphones
  }];
  const steps = [{
    title: "Get in Touch",
    description: "Share your staffing needs, preferred timeframe, and specific requirements. We respond to every staffing enquiry and agree next steps with you."
  }, {
    title: "Skills Match",
    description: "From our pre-vetted talent pool, we select professionals who meet your exact technical and clinical criteria."
  }, {
    title: "Deployment",
    description: "We manage onboarding, compliance checks, and orientation for a smooth start with minimal disruption."
  }, {
    title: "Ongoing Support",
    description: "Around-the-clock performance monitoring, regular feedback, and rapid adjustments to keep operations running seamlessly."
  }];
  return <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Hospital & Corporate Staffing in Lagos | Medic Connect" description="Vetted doctors, nurses, and allied health professionals deployed on demand to hospitals and corporates across Lagos." path="/hospital-staffing" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Hospital & Corporate Staffing","serviceType":"Healthcare staffing","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Vetted doctors, nurses, and allied health professionals deployed on demand to hospitals and corporates across Lagos.","url":"https://www.medicconnect.co/hospital-staffing","offers":{"@type":"Offer","priceCurrency":"NGN","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Quoted by role, shift, and volume. Contact us for a custom quote."}}}} />
      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img alt="Medical team in hospital" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" src="/lovable-uploads/aa39dd4e-561b-46b1-b124-ea0612dc2fd9.jpg" />
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  We Take Care of Your Staffing
                </h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Connecting hospitals, clinics, and care facilities with vetted doctors, nurses, and allied health professionals, on demand.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="/contact" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Request Staff
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Who We Serve */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-border/50 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-8 text-center">Our Clients</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {whoWeServe.map(item => <div key={item} className="interactive-list-item">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>)}
            </div>
          </div>
        </section>

        {/* Professionals We Provide - Flip Cards */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Professionals We Provide</h2>
            <p className="text-muted-foreground">Tap a card to learn more</p>
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden relative">
            {/* Left Arrow */}
            <button onClick={() => {
            const container = document.getElementById('professionals-carousel');
            container?.scrollBy({
              left: -280,
              behavior: 'smooth'
            });
          }} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center" aria-label="Scroll left">
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>

            <div id="professionals-carousel" className="overflow-x-auto scrollbar-hide px-10 pb-4" style={{
            WebkitOverflowScrolling: 'touch'
          }}>
              <div className="flex gap-4">
                {professionals.map((pro, index) => <div key={pro.title} className="flex-shrink-0 w-64 animate-slide-up" style={{
                animationDelay: `${index * 0.1}s`
              }}>
                    <FlipCard {...pro} />
                  </div>)}
              </div>
            </div>

            {/* Right Arrow */}
            <button onClick={() => {
            const container = document.getElementById('professionals-carousel');
            container?.scrollBy({
              left: 280,
              behavior: 'smooth'
            });
          }} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center" aria-label="Scroll right">
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {professionals.map((pro, index) => <div key={pro.title} className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                <FlipCard {...pro} />
              </div>)}
          </div>
        </section>

        {/* Our Services - Flip Cards */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink">Our Services</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service, index) => <div key={service.title} className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                <ServiceFlipCard {...service} />
              </div>)}
          </div>
        </section>

        {/* How It Works */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">How It Works</h2>
          </div>

          <div className="max-w-2xl mx-auto kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
            <Accordion type="single" collapsible defaultValue="step-0">
              {steps.map((step, index) => <AccordionItem key={index} value={`step-${index}`} className="border-border/50">
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
                </AccordionItem>)}
            </Accordion>
          </div>
        </section>


        {/* CTA Section */}
        <CTASection headline="Trusted, qualified healthcare professionals, ready when you need them." body="Tell us your staffing requirements. We'll handle the rest." secondaryButton={{
        text: "Request Staff",
        href: "/contact"
      }} />
      </main>

      <Footer />
    </div>;
};
export default HospitalStaffing;