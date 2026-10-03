import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import HoverCard from "@/components/HoverCard";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import CTASection from "@/components/CTASection";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import { 
  Stethoscope,
  UserCheck,
  Clock,
  FileCheck,
  MessageCircle
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import hospitalSupportHeroImage from "@/assets/hero/hospital-support-hero.jpg";
import housekeepingImage from "@/assets/services/hospital-housekeeping.jpg";
import laundryImage from "@/assets/services/hospital-laundry.jpg";
import securityImage from "@/assets/services/hospital-security.jpg";

const HospitalSupport = () => {
  const whoWeServe = [
    "Hospitals and clinics",
    "Diagnostic centers",
    "Nursing homes",
    "Pharmaceutical facilities",
    "Healthcare offices",
  ];

  const services = [
    {
      title: "Housekeeping & Grounds",
      description: "Daily cleaning, deep cleaning, and grounds upkeep with healthcare-grade infection control protocols.",
      href: "/hospital-support",
      image: housekeepingImage,
    },
    {
      title: "Laundry Services",
      description: "Professional handling of linens, scrubs, and patient materials with hygienic processing.",
      href: "/hospital-support",
      image: laundryImage,
    },
    {
      title: "Waste Management",
      description: "Compliant medical waste disposal, recycling programs, and sustainable practices.",
      href: "/hospital-support",
      image: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80",
    },
    {
      title: "Pest Control",
      description: "Regular pest management and emergency response with healthcare-appropriate treatments.",
      href: "/hospital-support",
      image: "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&q=80",
    },
    {
      title: "Security Services",
      description: "Trained security personnel for access control, patient safety, and 24/7 facility protection.",
      href: "/hospital-support",
      image: securityImage,
    },
  ];

  const benefits = [
    {
      title: "Healthcare-Specific Expertise",
      description: "We understand hospital environments and compliance requirements",
      icon: Stethoscope,
    },
    {
      title: "Trained Personnel",
      description: "Staff trained in infection control, safety, and healthcare protocols",
      icon: UserCheck,
    },
    {
      title: "Reliable Coverage",
      description: "Consistent service with backup staff for seamless operations",
      icon: Clock,
    },
    {
      title: "Flexible Contracts",
      description: "Daily, weekly, or long-term arrangements",
      icon: FileCheck,
    },
  ];

  const steps = [
    { title: "Get in Touch", description: "Tell us about your facility and support needs." },
    { title: "Site Assessment", description: "We visit to evaluate scope, frequency, and specific requirements." },
    { title: "Custom Proposal", description: "We provide a tailored plan and transparent pricing." },
    { title: "Service Begins", description: "Our trained teams deploy with clear protocols and ongoing quality management." },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Hospital Support Services in Lagos | Medic Connect" description="Housekeeping, laundry, waste management, pest control, and security for healthcare facilities across Lagos." path="/hospital-support" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Hospital Support Services","serviceType":"Facility support services","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Housekeeping, laundry, waste management, pest control, and security for healthcare facilities across Lagos.","url":"https://www.medicconnect.co/hospital-support","offers":{"@type":"Offer","priceCurrency":"NGN","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Scoped to facility size and service mix. Contact us for a quote."}}}} />
      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={hospitalSupportHeroImage}
                alt="Hospital facility"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  We Take Care of Your Hospital
                </h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Complete facility solutions for seamless hospital operations. We keep your facility running smoothly: safe, clean, and efficient.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="/contact" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Get a Quote
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Our Clients */}
        <ClientsScrollSection clients={whoWeServe} />

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


        {/* CTA Section */}
        <CTASection 
          headline="Keep your facility running at its best."
          body="Let's discuss how we can support your operations."
          secondaryButton={{ text: "Request a Quote", href: "/contact" }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default HospitalSupport;
