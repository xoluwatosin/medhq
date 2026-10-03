import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import CTASection from "@/components/CTASection";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import { Stethoscope, Heart, Activity, HeartPulse, Shield, UserCheck, Clock, Phone as PhoneIcon, BadgeCheck, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import clinicalHeroImage from "@/assets/hero/clinical-hero.jpg";
import skilledNursingImage from "@/assets/services/skilled-nursing.jpg";
import woundCareImage from "@/assets/services/wound-care.jpg";
import ivTherapyImage from "@/assets/services/iv-therapy.jpg";
import postOperativeImage from "@/assets/services/post-operative.jpg";
import catheterStomaImage from "@/assets/services/catheter-stoma.jpg";
const ClinicalHomeCare = () => {
  const whoWeHelp = [{
    title: "Post-Surgical Patients",
    description: "Recovering from surgery requires consistent monitoring and skilled care.",
    icon: Activity,
    backContent: "Our nurses manage wound care, medication administration, pain management, and rehabilitation support, helping you heal faster at home."
  }, {
    title: "Chronic Illness Patients",
    description: "Living with diabetes, hypertension, or heart disease requires ongoing attention.",
    icon: HeartPulse,
    backContent: "We provide regular monitoring, medication management, and lifestyle support to keep you stable and comfortable."
  }, {
    title: "Elderly Patients",
    description: "Dignified geriatric care that prioritizes independence.",
    icon: Heart,
    backContent: "From daily living assistance to medical monitoring, we help seniors maintain quality of life while giving families peace of mind."
  }, {
    title: "Individuals with IDD",
    description: "Compassionate, patient-centered care tailored to unique needs.",
    icon: Stethoscope,
    backContent: "Our caregivers are trained to provide respectful support that promotes independence and dignity for individuals with intellectual or developmental disabilities."
  }];
  const services = [{
    title: "Skilled Nursing Care",
    description: "Professional nursing care including medication administration, vital signs monitoring, and health assessments.",
    href: "/clinical-home-care",
    image: skilledNursingImage
  }, {
    title: "Wound Care & Dressing",
    description: "Expert wound management, surgical site care, and dressing changes following clinical protocols.",
    href: "/clinical-home-care",
    image: woundCareImage
  }, {
    title: "IV Therapy & Injections",
    description: "Safe administration of intravenous medications, fluids, and injection treatments at home.",
    href: "/clinical-home-care",
    image: ivTherapyImage
  }, {
    title: "Post-Operative Care",
    description: "Comprehensive recovery support after surgery including monitoring, pain management, and rehabilitation.",
    href: "/clinical-home-care",
    image: postOperativeImage
  }, {
    title: "Catheter & Stoma Care",
    description: "Specialized care for urinary catheters, colostomy bags, and other medical devices.",
    href: "/clinical-home-care",
    image: catheterStomaImage
  }, {
    title: "Physiotherapy Support",
    description: "Movement therapy and rehabilitation exercises to restore mobility and function.",
    href: "/clinical-home-care",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80"
  }];
  const benefits = [{
    title: "HEFAMAA Accredited",
    description: "Licensed and fully compliant with Lagos State health regulations",
    icon: Shield
  }, {
    title: "Vetted Professionals",
    description: "Background checks, license verification, and skill assessments for all staff",
    icon: UserCheck
  }, {
    title: "Personalized Care Plans",
    description: "Tailored to your specific medical and personal needs",
    icon: Heart
  }, {
    title: "Flexible & Fast",
    description: "Urgent cover or ongoing care, on your timeline",
    icon: Clock
  }, {
    title: "24/7 Support",
    description: "Round-the-clock coordination and emergency response",
    icon: PhoneIcon
  }];
  const steps = [{
    title: "Get in Touch",
    description: "Reach out via WhatsApp or phone. Share your care needs and current situation."
  }, {
    title: "Free Consultation",
    description: "We'll discuss your requirements in detail and recommend the right care plan."
  }, {
    title: "Home Assessment",
    description: "A qualified nurse visits to evaluate the patient and home environment. (Assessment fee applies)"
  }, {
    title: "Care Begins",
    description: "We match you with the right professional, create a tailored care plan, and coordinate your start date."
  }];
  return <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Clinical Home Care in Lagos from ₦12,000 | Medic Connect" description="Skilled nursing, IV therapy, wound care and chronic illness management at home in Lagos. From ₦12,000 per visit. 24-hour nursing from ₦55,000 per day." path="/clinical-home-care" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Clinical Home Care","serviceType":"Home health nursing","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Skilled nursing, post-surgical care, and chronic illness management at home in Lagos. Vetted healthcare professionals from Medic Connect.","url":"https://www.medicconnect.co/clinical-home-care","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"12000","highPrice":"55000","offerCount":"9","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Nursing visits from ₦12,000. 24-hour nursing from ₦55,000 per day. Wound care from ₦5,000 per visit."}}}} />
      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img src={clinicalHeroImage} alt="Home care nurse with patient" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
              <div className="absolute top-6 left-6 px-4 py-2 kit-curve-sm bg-white text-navy text-sm font-medium flex items-center gap-2">
                <BadgeCheck className="w-4 h-4" />
                HEFAMAA Accredited
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">24/7 Care You Can Trust, Right at Home</h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Professional medical care delivered in the comfort of your home. Our vetted healthcare professionals provide personalized support for recovery, chronic illness management, and daily living assistance.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-slide-up stagger-2">
                <CareRequestDialog
            serviceLineKey="clinical_home_care"
            source="hero:clinical_home_care"
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
        <ClientsScrollSection clients={whoWeHelp} useFlipCards />

        {/* Our Services - Flip Cards */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink">Our Services</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => <div key={service.title} className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                <ServiceFlipCard {...service} />
              </div>)}
          </div>
        </section>

        {/* How It Works - Accordion */}
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

        {/* Why Choose Us */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Why Choose Medic Connect</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => <HoverCard key={benefit.title} {...benefit} index={index} />)}
          </div>
        </section>

        {/* CTA Section */}
        <CTASection headline="Ready to bring quality care home?" body="Speak with our care team today. We'll help you find the right support for your loved one." />
      </main>

      <Footer />
    </div>;
};
export default ClinicalHomeCare;