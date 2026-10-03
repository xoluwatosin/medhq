import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import mOSoft from "@/assets/brand/m-o-soft.svg";

import mCrossSoft from "@/assets/brand/m-cross-soft.svg";
import mFullSoft from "@/assets/brand/m-full-soft.svg";
import CTASection from "@/components/CTASection";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Clock,
  Shield,
  UserCheck,
  MessageCircle,
  Stethoscope,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import antenatalHeroImage from "@/assets/hero/antenatal-hero.jpg";
import antenatalCareImage from "@/assets/services/antenatal-care.jpg";
import skilledNursingImage from "@/assets/services/skilled-nursing.jpg";
import postOperativeImage from "@/assets/services/post-operative.jpg";
import postnatalCareImage from "@/assets/services/postnatal-care.jpg";

const AntenatalCare = () => {
  const whoWeHelp = [
    "Expectant mothers with high-risk pregnancies",
    "Women on bed rest or limited mobility",
    "First-time mothers seeking guidance",
    "Mothers managing gestational diabetes or hypertension",
    "Families wanting professional pregnancy support at home",
  ];

  const services = [
    {
      title: "Midwife Home Visits",
      description:
        "Regular scheduled visits from qualified midwives for check-ups, vitals monitoring, and pregnancy progress tracking in your home.",
      image: antenatalCareImage,
      watermark: {
        src: mOSoft,
        className: "w-[86px] opacity-20 md:w-[168px] md:opacity-25",
        style: { right: "-26px", bottom: "-28px" },
      },
    },
    {
      title: "Blood Pressure & Preeclampsia Monitoring",
      description:
        "Self-testing support and professional monitoring for hypertension and preeclampsia to catch warning signs early.",
      image: skilledNursingImage,
      watermark: {
        src: mCrossSoft,
        className: "w-[70px] opacity-[0.16] md:w-[132px] md:opacity-20",
        style: { left: "-18px", top: "-22px" },
      },
    },
    {
      title: "Telehealth Consultations",
      description:
        "Virtual check-ins with healthcare professionals for questions, symptom reviews, and ongoing guidance between visits.",
      image: postOperativeImage,
    },
    {
      title: "Maternal Education & Birth Prep",
      description:
        "Personalized education on nutrition, exercise, labour preparation, breastfeeding, and newborn care.",
      image: postnatalCareImage,
      watermark: {
        src: mFullSoft,
        className: "w-[92px] opacity-[0.16] md:w-[170px] md:opacity-20",
        style: { left: "-24px", bottom: "-26px" },
      },
    },
  ];

  const caregiverQualities = [
    "Registered midwives and nurses",
    "Experience with high-risk pregnancies",
    "Trained in emergency obstetric protocols",
    "Compassionate and culturally sensitive",
    "Background checked and verified",
  ];

  const benefits = [
    {
      title: "Expert Midwifery Care",
      description:
        "Qualified midwives bring clinical-grade pregnancy care to your home",
      icon: Stethoscope,
    },
    {
      title: "Early Risk Detection",
      description:
        "Continuous monitoring helps catch complications like preeclampsia early",
      icon: Shield,
    },
    {
      title: "Comfort of Home",
      description:
        "Reduce hospital visits while receiving professional antenatal support",
      icon: Heart,
    },
    {
      title: "Flexible Scheduling",
      description:
        "Visits scheduled around your routine: mornings, evenings, or weekends",
      icon: Clock,
    },
  ];

  const steps = [
    {
      title: "Get in Touch",
      description:
        "Tell us about your pregnancy stage, any conditions, and what support you need.",
    },
    {
      title: "Consultation",
      description:
        "We discuss your medical history, preferences, and create a preliminary care outline.",
    },
    {
      title: "Assessment",
      description:
        "A qualified midwife visits your home to assess your needs and environment. (Assessment fee applies)",
    },
    {
      title: "Care Begins",
      description:
        "Regular home visits begin with a personalized antenatal care plan tailored to your pregnancy journey.",
    },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Antenatal Care at Home in Lagos from ₦30,000 | Medic Connect" description="Expert pregnancy monitoring at home: vitals checks, midwife visits, telehealth and education across Lagos. Routine antenatal visits from ₦30,000." path="/antenatal-care" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Antenatal Care at Home","serviceType":"Antenatal care","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Expert pregnancy monitoring at home: vitals checks, telehealth, and education on nutrition, rest, and warning signs across Lagos.","url":"https://www.medicconnect.co/antenatal-care","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"30000","highPrice":"140000","offerCount":"3","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Routine antenatal visit ₦30,000. High-risk pregnancy visit ₦40,000. Trimester antenatal package from ₦140,000. Formal care assessment ₦35,000."}}}} />
      <MedicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={antenatalHeroImage}
                alt="Pregnant woman receiving antenatal care at home"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  Antenatal Care at Home
                </h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Professional pregnancy care delivered in the comfort of your
                  home: midwife visits, monitoring, telehealth, and maternal
                  education for a safe and supported journey.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up stagger-2">
                <CareRequestDialog
            serviceLineKey="antenatal"
            source="hero:antenatal"
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

        {/* Why Choose Us */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink">
              Why Choose Home Antenatal Care
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className={`p-6 kit-curve bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all animate-slide-up stagger-${Math.min(index + 1, 6)}`}
                >
                  <div className="w-12 h-12 kit-curve-sm bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Our Services - Flip Cards */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink">
              Our Services
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {services.map((service, index) => (
              <div
                key={service.title}
                className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}
              >
                <ServiceFlipCard {...service} />
              </div>
            ))}
          </div>
        </section>

        {/* Our Caregivers */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-muted p-8 md:p-12 animate-slide-up">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-8">
                Our Midwives & Nurses
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {caregiverQualities.map((quality) => (
                  <div
                    key={quality}
                    className="flex items-center gap-3 p-4 rounded-xl bg-card hover:scale-[1.02] transition-transform"
                  >
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
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">
              How It Works
            </h2>
          </div>

          <div className="max-w-2xl mx-auto kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
            <Accordion type="single" collapsible defaultValue="step-0">
              {steps.map((step, index) => (
                <AccordionItem
                  key={index}
                  value={`step-${index}`}
                  className="border-border/50"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-lg">
                        {step.title}
                      </span>
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
          headline="A healthy pregnancy starts with the right support."
          body="Let us bring expert antenatal care to your doorstep."
          secondaryButton={{ text: "Book a Consultation", href: "/contact" }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default AntenatalCare;
