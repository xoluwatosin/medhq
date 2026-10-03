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
  Heart, 
  Clock, 
  Shield,
  UserCheck,
  MessageCircle
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import pediatricHeroImage from "@/assets/hero/pediatric-hero.jpg";
import pediatricNursingImage from "@/assets/services/pediatric-nursing.jpg";
import pediatricDevelopmentImage from "@/assets/services/pediatric-development.jpg";
import pediatricDailyLivingImage from "@/assets/services/pediatric-daily-living.jpg";
import pediatricRespiteImage from "@/assets/services/pediatric-respite.jpg";
import pediatricTherapyImage from "@/assets/services/pediatric-therapy.jpg";
import pediatricSchoolImage from "@/assets/services/pediatric-school.jpg";

const PediatricCare = () => {
  const whoWeHelp = [
    "Children with chronic medical conditions",
    "Children with intellectual or developmental disabilities",
    "Children recovering from surgery or illness",
    "Families needing skilled nursing for pediatric patients",
    "Parents seeking respite care",
  ];

  const services = [
    {
      title: "Skilled Pediatric Nursing",
      description: "Medication administration, feeding tube management, tracheostomy care, and continuous monitoring from specialized pediatric nurses.",
      href: "/pediatric-care",
      image: pediatricNursingImage,
    },
    {
      title: "Developmental Support",
      description: "Caregivers trained to support children with autism, Down syndrome, cerebral palsy, and other developmental conditions.",
      href: "/pediatric-care",
      image: pediatricDevelopmentImage,
    },
    {
      title: "Daily Living Assistance",
      description: "Help with feeding, bathing, dressing, and mobility for children who need extra support.",
      href: "/pediatric-care",
      image: pediatricDailyLivingImage,
    },
    {
      title: "Respite Care",
      description: "Temporary coverage so family caregivers can rest, work, or handle other responsibilities with peace of mind.",
      href: "/pediatric-care",
      image: pediatricRespiteImage,
    },
    {
      title: "Therapy Support",
      description: "Coordination with physiotherapists, occupational therapists, and speech therapists to reinforce therapy goals.",
      href: "/pediatric-care",
      image: pediatricTherapyImage,
    },
    {
      title: "School Support",
      description: "Accompaniment to school, assistance with routines, and communication with teachers about care needs.",
      href: "/pediatric-care",
      image: pediatricSchoolImage,
    },
  ];

  const caregiverQualities = [
    "Pediatric nursing experience",
    "Training in special needs care",
    "Background checked and verified",
    "Patient, compassionate, and engaging",
    "Infant and child CPR certified",
  ];

  const benefits = [
    {
      title: "Specialized Training",
      description: "Caregivers experienced with pediatric and special needs patients",
      icon: UserCheck,
    },
    {
      title: "Child-Centered",
      description: "Care plans built around your child's abilities and interests",
      icon: Heart,
    },
    {
      title: "Family Partnership",
      description: "We work closely with parents and coordinate with your child's medical team",
      icon: Shield,
    },
    {
      title: "Flexible Options",
      description: "Hourly, daily, overnight, or respite care",
      icon: Clock,
    },
  ];

  const steps = [
    { title: "Get in Touch", description: "Share your child's condition, needs, and your family's situation." },
    { title: "Consultation", description: "We discuss care requirements in detail and answer your questions." },
    { title: "Assessment", description: "A qualified nurse visits to evaluate your child's needs and your home setup. (Assessment fee applies)" },
    { title: "Care Begins", description: "We match your child with the right caregiver and build a care plan around their routines, therapies, and goals." },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Paediatric & Special Needs Care in Lagos from ₦15,000 | Medic Connect" description="Specialised in-home support for children with medical and developmental needs across Lagos. Sick child visits from ₦15,000. Neonatal nursing from ₦30,000." path="/pediatric-care" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Pediatric & Special Needs Care","serviceType":"Pediatric home care","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Specialised in-home support for children with medical conditions and developmental needs. Trained Lagos-based caregivers.","url":"https://www.medicconnect.co/pediatric-care","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"15000","highPrice":"350000","offerCount":"6","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Sick child visit from ₦15,000. Neonatal day nursing from ₦30,000. Post-stroke / rehab packages from ₦350,000."}}}} />
      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={pediatricHeroImage}
                alt="Child receiving care"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  Specialized Care for Children with Unique Needs
                </h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Compassionate, skilled support for children with medical conditions, developmental differences, and special needs, delivered at home with patience and expertise.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up stagger-2">
                <CareRequestDialog
            serviceLineKey="paediatric"
            source="hero:paediatric"
            trigger={
              <Button className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                <MessageCircle className="w-5 h-5" />
                Request care
              </Button>
            }
          />
              </div>
            </div>
          </div>
        </section>

        {/* Our Clients */}
        <ClientsScrollSection clients={whoWeHelp} />

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

        {/* Our Caregivers */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-muted p-8 md:p-12 animate-slide-up">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-8">Our Caregivers</h2>
              
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


        {/* CTA Section */}
        <CTASection 
          headline="Your child deserves expert, compassionate care."
          body="Let's build a support plan that works for your family."
          secondaryButton={{ text: "Book a Consultation", href: "/contact" }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default PediatricCare;
