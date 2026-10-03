import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import CTASection from "@/components/CTASection";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  FlaskConical, 
  ClipboardCheck, 
  MessageCircle,
  Microscope,
  Database
} from "lucide-react";

import clinicalResearchHeroImage from "@/assets/hero/clinical-research-hero.jpg";

const ClinicalResearch = () => {
  const clients = [
    { 
      title: "Pharmaceutical Companies", 
      description: "Global and local pharma conducting clinical trials in Nigeria",
      icon: FlaskConical 
    },
    { 
      title: "Research Institutions", 
      description: "Academic and private organizations running health studies",
      icon: Microscope 
    },
    { 
      title: "Hospitals & Clinics", 
      description: "Healthcare facilities with internal research programs",
      icon: ClipboardCheck 
    },
    { 
      title: "CROs & Sponsors", 
      description: "Contract Research Organizations managing multi-site trials",
      icon: Database 
    },
  ];

  const services = [
    {
      title: "Clinical Trial Support",
      description: "Trained coordinators and research nurses to support all phases of clinical trials.",
      href: "/clinical-research",
      image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80",
    },
    {
      title: "Patient Recruitment",
      description: "Strategic patient identification and enrollment support to meet recruitment targets.",
      href: "/clinical-research",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80",
    },
    {
      title: "Data Management",
      description: "Qualified data entry specialists and managers for accurate, compliant data handling.",
      href: "/clinical-research",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    },
    {
      title: "Regulatory Support",
      description: "Personnel briefed on the NAFDAC, IRB and international regulatory requirements the study sets.",
      href: "/clinical-research",
      image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80",
    },
    {
      title: "Laboratory Staffing",
      description: "Lab technicians and phlebotomists for sample collection and processing.",
      href: "/clinical-research",
      image: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&q=80",
    },
    {
      title: "Administrative Support",
      description: "Research assistants and administrative staff for documentation and coordination.",
      href: "/clinical-research",
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    },
  ];


  const crFaqs = [
    { q: "Are you a Clinical Research Organisation (CRO) in Nigeria?", a: "Medic Connect is a clinical research staffing and support partner based in Lagos. We supply coordinators, research nurses, data managers and lab staff to CROs, sponsors, hospitals and academic institutions running trials in Nigeria, matched to each protocol's stated requirements." },
    { q: "What therapeutic areas do you cover?", a: "Our research workforce supports trials across maternal & child health, infectious diseases (including HIV, TB and malaria), oncology, cardiovascular, diabetes, mental health and vaccine studies." },
    { q: "Are your research staff GCP and NAFDAC compliant?", a: "Research personnel are selected against the protocol's stated training and regulatory requirements, and evidence of GCP training and regulatory briefing is confirmed per study. We can deploy across Lagos and other Nigerian states." },
    { q: "How quickly can you staff a clinical trial site?", a: "Deployment timelines are agreed at scoping and depend on protocol complexity, geography and required certifications." },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Clinical Research Organisation Staffing in Nigeria | Medic Connect" description="Clinical research coordinators, study nurses, data managers and lab staff for trials and studies across Nigeria, matched to each protocol. CRO and sponsor support in Lagos." path="/clinical-research" jsonLd={[{"@context":"https://schema.org","@type":"Service","name":"Clinical Research & Support","serviceType":"Clinical research staffing","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Country","name":"Nigeria"},"description":"Research coordinators, study nurses, data managers and lab staff for pharmaceutical trials and academic studies across Nigeria, matched to each protocol's stated requirements.","url":"https://www.medicconnect.co/clinical-research"},{"@context":"https://schema.org","@type":"FAQPage","mainEntity":crFaqs.map(f=>({"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}}))}]} />

      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={clinicalResearchHeroImage}
                alt="Clinical research laboratory"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute top-6 left-6 px-4 py-2 kit-curve-sm bg-white text-navy text-sm font-medium flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                Protocol-matched research teams
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  Powering Clinical Research in Nigeria
                </h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Qualified research coordinators, data managers, and support staff for pharmaceutical trials, academic research, and healthcare studies. Protocol-matched research teams.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="/contact" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Discuss Your Project
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Our Clients */}
        <ClientsScrollSection clients={clients} />

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


        {/* SEO content + FAQ */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card border border-border/50 p-6 md:p-10 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Clinical Research Staffing in Nigeria — Therapeutic Areas & Capabilities</h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6 max-w-3xl">
              We support sponsors, CROs, hospitals and academic groups running clinical trials and health studies in Lagos and across Nigeria. Research personnel are selected against the protocol's stated training and regulatory requirements, including GCP, NAFDAC, NHREC and IRB where the study requires them, with experience across maternal &amp; child health, infectious diseases (HIV, TB, malaria), oncology, cardiovascular, diabetes, mental health and vaccine studies.
            </p>
            <div className="max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
                {crFaqs.map((f, i) => (
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
          headline="Ready to staff your research project?"
          body="Connect with our team to discuss your clinical research staffing needs."
        />
      </main>

      <Footer />
    </div>
  );
};

export default ClinicalResearch;
