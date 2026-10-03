import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import { medicalServiceSchema } from "@/lib/medical-schema";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import CTASection from "@/components/CTASection";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import { 
  Heart, 
  UserCheck,
  Brain,
  MessageSquare,
  MessageCircle
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import eldercareHeroImage from "@/assets/hero/eldercare-hero.jpg";
import dailyLivingImage from "@/assets/services/eldercare-daily-living.jpg";
import medicationImage from "@/assets/services/eldercare-medication.jpg";
import mealPrepImage from "@/assets/services/eldercare-meal-prep.jpg";
import companionshipImage from "@/assets/services/eldercare-companionship.jpg";
import dementiaImage from "@/assets/services/eldercare-dementia.jpg";
import mobilityImage from "@/assets/services/eldercare-mobility.jpg";

const Eldercare = () => {
  const whoWeHelp = [
    "Seniors needing daily living assistance",
    "Elderly patients recovering from illness or surgery",
    "Individuals with dementia or Alzheimer's",
    "Families seeking respite from caregiving",
    "Seniors who need companionship and social engagement",
  ];

  const services = [
    {
      title: "Daily Living Support",
      description: "Assistance with bathing, dressing, grooming, toileting, and mobility to maintain dignity and independence.",
      href: "/eldercare",
      image: dailyLivingImage,
    },
    {
      title: "Medication Management",
      description: "Reminders and assistance to ensure medications are taken correctly and on time.",
      href: "/eldercare",
      image: medicationImage,
    },
    {
      title: "Meal Preparation",
      description: "Nutritious meals prepared according to dietary needs, preferences, and health requirements.",
      href: "/eldercare",
      image: mealPrepImage,
    },
    {
      title: "Companionship",
      description: "Conversation, games, reading, walks, and social engagement to combat loneliness.",
      href: "/eldercare",
      image: companionshipImage,
    },
    {
      title: "Dementia & Alzheimer's Care",
      description: "Specialized support from caregivers trained in memory care with patience and dignity.",
      href: "/eldercare",
      image: dementiaImage,
    },
    {
      title: "Mobility Assistance",
      description: "Help with walking, transfers, and fall prevention to maintain safety and independence.",
      href: "/eldercare",
      image: mobilityImage,
    },
  ];

  const benefits = [
    {
      title: "Dignity First",
      description: "We treat every senior with respect and patience",
      icon: Heart,
    },
    {
      title: "Vetted Caregivers",
      description: "Background checks, training, and ongoing supervision",
      icon: UserCheck,
    },
    {
      title: "Personalized Plans",
      description: "Care tailored to health conditions, preferences, and routines",
      icon: Brain,
    },
    {
      title: "Family Communication",
      description: "Regular updates so you always know how your loved one is doing",
      icon: MessageSquare,
    },
  ];

  const steps = [
    { title: "Get in Touch", description: "Tell us about your loved one's needs and current situation." },
    { title: "Free Consultation", description: "We discuss care requirements, preferences, and family concerns." },
    { title: "Home Assessment", description: "A care coordinator visits to evaluate needs and the home environment. (Assessment fee applies)" },
    { title: "Care Begins", description: "We match your loved one with a compassionate caregiver and create a personalized care plan." },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Eldercare & Companion Care in Lagos from ₦12,000 | Medic Connect"
        description="Dignified in-home care for seniors from ₦12,000 per visit. 24-hour nursing from ₦55,000 per day. Compassionate, vetted carers across Lagos."
        path="/eldercare"
        jsonLd={medicalServiceSchema({
          name: "Eldercare & Companion Care",
          path: "/eldercare",
          description: "Dignified in-home care helping seniors maintain independence and quality of life. Skilled nurses and compassionate companion carers across Lagos.",
          specialty: "Geriatric",
          audienceType: "Older adults living at home in Lagos",
          includeDiaspora: true,
          relatedProcedures: [
            "Activities of daily living assistance",
            "Medication administration",
            "Mobility and fall-prevention support",
            "Dementia and Alzheimer's home care",
            "Chronic disease monitoring (hypertension, diabetes)",
            "24-hour live-in nursing",
          ],
          offers: {
            lowPrice: 12000,
            highPrice: 500000,
            offerCount: 6,
            description: "From ₦12,000 per visit. 24-hour nursing from ₦55,000 per day. Dementia care package from ₦500,000.",
          },
        })}
      />
      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img
                src={eldercareHeroImage}
                alt="Caregiver with elderly patient"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>

            <div className="flex flex-col justify-center space-y-5 md:space-y-7">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-navy w-fit animate-fade-in">
                Eldercare in Lagos
              </span>
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  Be their child again. We'll handle the care.
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg md:text-xl leading-relaxed max-w-xl animate-slide-up stagger-1">
                  Bringing in professional care isn't stepping back. It's making sure they're safe, sleeping well and eating right, so you can stop being the nurse and go back to being the son or daughter.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-slide-up stagger-2">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="https://wa.me/2348126988237?text=Hi%20Medic%20Connect%2C%20I%27d%20like%20to%20arrange%20eldercare." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Chat on WhatsApp
                  </a>
                </Button>
                <CareRequestDialog
            serviceLineKey="eldercare"
            source="hero:eldercare"
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

        {/* Guilt-dissolving + per-visit reports + cost reframe */}
        <section className="py-10 md:py-12">
          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            <div className="kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
              <h3 className="font-bold text-lg mb-3">Stay the son or daughter</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                You carry enough already. We take on the bathing, the medication, the night cover, so your time with them goes back to being love, not logistics.
              </p>
            </div>
            <div className="kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up stagger-1">
              <h3 className="font-bold text-lg mb-3">Per-visit reports</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                After every visit you get a short WhatsApp note: how they slept, what they ate, vitals, mood, anything that needs your attention. Family abroad always know.
              </p>
            </div>
            <div className="kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up stagger-2">
              <h3 className="font-bold text-lg mb-3">Predictable care, not surprise bills</h3>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                A monthly eldercare plan is almost always less stressful, and less expensive, than one unplanned hospital admission you could have prevented.
              </p>
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

        {/* Diaspora callout */}
        <section className="py-10 md:py-12">
          <a href="/care-from-abroad" className="block kit-curve-lg bg-card p-8 md:p-12 border border-border/50 hover:border-primary/40 transition-all animate-slide-up">
            <div className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center">
              <div>
                <span className="inline-block text-xs font-semibold tracking-wider uppercase text-accent-foreground bg-accent/30 rounded-full px-3 py-1 mb-4">For family abroad</span>
                <h3 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.02em] text-ink mb-3">Looking after a parent in Lagos from London, New York or Toronto?</h3>
                <p className="text-muted-foreground text-base md:text-lg">Per-visit WhatsApp reports, scheduling across time zones, international billing. Stay the son or daughter and let us be the hands.</p>
              </div>
              <div className="text-primary font-semibold whitespace-nowrap">Care from Abroad →</div>
            </div>
          </a>
        </section>

        {/* CTA Section */}
        <CTASection 
          headline="Your loved one deserves compassionate care."
          body="Let's create a plan that gives them comfort and gives you peace of mind."
          secondaryButton={{ text: "Book a Consultation", href: "/contact" }}
        />
      </main>

      <Footer />
    </div>
  );
};

export default Eldercare;
