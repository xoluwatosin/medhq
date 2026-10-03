import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import { medicalServiceSchema, faqSchema } from "@/lib/medical-schema";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import { Baby, Moon, Sun, Heart, BookOpen, Sparkles, Shield, UserCheck, Download, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import postnatalHeroImage from "@/assets/hero/postnatal-hero.jpg";
const PostnatalCare = () => {
  const whoWeSupport = ["Expectant families preparing for arrival", "Mothers in postpartum recovery", "High-risk pregnancies requiring extra monitoring", "Newborns needing attentive care", "Working mothers and returning-to-work families"];
  const pillars = [{
    title: "Rest",
    description: "Choose from daytime or overnight care. Our Care Specialists are experienced in newborn and night care, giving you time to sleep and recharge.",
    icon: Moon
  }, {
    title: "Recover",
    description: "Every birth and recovery is different. Our team provides guidance and resources to support your healing: footbaths, warming pads, lactation teas, and broths.",
    icon: Heart
  }, {
    title: "Learn",
    description: "Our Care Specialists come prepared with resources and workshops: breastfeeding techniques, baby health, milestones, and troubleshooting.",
    icon: BookOpen
  }, {
    title: "Enjoy",
    description: "Take full advantage of our Care Team. Enjoy 1:1 bonding time while we handle light meal prep or tidy the nursery.",
    icon: Sparkles
  }];
  const daytimeSchedule = [{
    time: "8 AM",
    activity: "Care Specialist arrives. Checks on Mama's recovery, reviews sleep and feeding."
  }, {
    time: "9 AM",
    activity: "Prepares breakfast and cares for baby while Mama eats."
  }, {
    time: "10 AM",
    activity: "Mama showers and naps while baby is cared for."
  }, {
    time: "12 PM",
    activity: "Lunch is warmed while Mama feeds baby."
  }, {
    time: "2 PM",
    activity: "Mama and baby nap. Care Specialist preps light snack."
  }, {
    time: "4 PM",
    activity: "Care Specialist reviews baby care log and departs."
  }];
  const overnightSchedule = [{
    time: "9 PM",
    activity: "Care Specialist arrives. Checks on Mama's recovery."
  }, {
    time: "10 PM",
    activity: "Assists Mama in preparing for bed. Takes over baby monitoring."
  }, {
    time: "12 AM",
    activity: "Gently wakes Mama to breastfeed or performs bottle feeding."
  }, {
    time: "3 AM",
    activity: "Bottle feeds baby while Mama has a longer stretch of sleep."
  }, {
    time: "6 AM",
    activity: "Washes and sterilizes bottles. Meal prep for the day ahead."
  }, {
    time: "7 AM",
    activity: "Reviews baby care log, answers questions, and departs."
  }];
  const qualifications = ["Extensive experience with newborns and new parents", "Passed police and background checks", "Training in working with vulnerable populations", "Ongoing screening, education, and workshop training", "Infant CPR certification"];
  const addOns = ["In-home lactation consultation (1 hour)", "In-home postpartum massage (1 hour)", "In-home postpartum massage (90 mins)", "In-home newborn photoshoot", "Food delivery (3+ days)"];
  const faqs = [{
    q: "Is this Omugwo care?",
    a: "Yes. We honour the tradition: a trained woman in the home cooking, bathing baby, watching over Mama and helping the household rest. The difference is professional vetting, infant CPR, lactation know-how and discreet clinical screening for Mama and baby. We complement family, never replace them."
  }, {
    q: "My mother or mother-in-law is coming. Do we still need you?",
    a: "Often, yes — alongside her, not instead of her. Many families book us for overnight care so grandma can sleep, or for the weeks after she returns home. We work to her preferences and recipes."
  }, {
    q: "Can this be sent as a gift from abroad?",
    a: "Yes. Many of our diaspora clients gift postnatal and Omugwo packages to sisters, daughters or friends in Lagos. We coordinate with the family on the ground, send per-visit reports on WhatsApp, and bill you directly."
  }, {
    q: "How do you screen for postnatal depression?",
    a: "Our Care Specialists are trained to spot signs of postnatal depression and anxiety (which affects roughly 1 in 4 Nigerian mothers). With your consent, we flag concerns early and connect you to a clinician in our network."
  }, {
    q: "I have support requests that aren't listed in the sample schedule. Will they be available?",
    a: "Yes, every care plan is customised. Let us know your specific needs during consultation."
  }, {
    q: "Can I speak to my night nurse or care specialist before my services begin?",
    a: "Absolutely. We arrange introductions on WhatsApp or in person so you can confirm fit before care starts."
  }, {
    q: "What if I need to change my care specialist?",
    a: "We'll work with you to find a better match at no additional charge."
  }, {
    q: "Do you provide care for twins or multiples?",
    a: "Yes. We'll recommend an adjusted care plan and may suggest additional support."
  }];
  const steps = [{
    title: "Submit Your Request",
    description: "Tell us what you're looking for and how we can support you best."
  }, {
    title: "Match with Your Care Team",
    description: "We match you with care specialists and introduce you to confirm fit."
  }, {
    title: "Confirm Booking",
    description: "After selecting your care specialist, we confirm your booking and stay in touch."
  }];
  return <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Omugwo & Postnatal Care in Lagos from ₦100,000 | Medic Connect"
        description="The care your mother would give, by trained professionals. Omugwo packages from ₦100,000, with overnight cover, lactation support, and quiet screening for postnatal depression."
        path="/postnatal-care"
        jsonLd={[
          medicalServiceSchema({
            name: "Omugwo & Postnatal Care",
            path: "/postnatal-care",
            description: "The care your mother would give, delivered by trained Care Specialists. Honouring the Nigerian Omugwo tradition with professional vetting, infant CPR and lactation support.",
            specialty: "Obstetric",
            audienceType: "New mothers and newborns in Lagos",
            includeDiaspora: true,
            relatedProcedures: [
              "Omugwo postpartum care",
              "Lactation and breastfeeding support",
              "Newborn bathing and cord care",
              "Postnatal depression screening",
              "Post-Caesarean wound monitoring",
              "Infant CPR-trained overnight cover",
            ],
            offers: {
              lowPrice: 100000,
              highPrice: 380000,
              offerCount: 4,
              description: "Omugwo packages from ₦100,000 (Light) to ₦380,000 (Full 24/7). Post-Caesarean Recovery package from ₦250,000.",
            },
          }),
          faqSchema(faqs),
        ]}
      />


      <MedicHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero Section */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-12 lg:p-16">
            <div className="relative aspect-[4/3] md:aspect-auto kit-curve overflow-hidden animate-scale-in">
              <img src={postnatalHeroImage} alt="Mother with newborn baby" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
            </div>

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-navy w-fit animate-fade-in">
                  Omugwo, professionally delivered
                </span>
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                  The care your mother would give.
                </h1>
                <p className="text-body-navy text-[17px] md:text-[20px] leading-[1.6] max-w-xl animate-slide-up stagger-1">
                  Trained Care Specialists in your home so Mama can sleep, heal and bond with baby. Cooking, bathing baby, overnight cover, lactation support and quiet eyes on Mama's recovery. Loved ones welcome alongside, never replaced.
                </p>
              </div>

              <div className="flex-col gap-3 pt-2 animate-slide-up stagger-2 items-center sm:items-start justify-center flex sm:flex-row">
                <Button asChild className="kit-curve-sm bg-white text-navy hover:bg-white/90 px-7 py-6 text-base font-semibold transition-opacity">
                  <a href="https://wa.me/2348126988237" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Chat on WhatsApp
                  </a>
                </Button>
                <CareRequestDialog
            serviceLineKey="postnatal"
            source="hero:postnatal"
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

        {/* Omugwo + PPD context band */}
        <section className="py-6 md:py-10">
          <div className="kit-curve-lg bg-card border border-border/50 p-6 md:p-10 animate-slide-up">
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">1 in 4</p>
                <p className="text-sm md:text-base text-muted-foreground mt-2">Nigerian mothers experience postnatal depression. We're trained to spot it early and connect you to help, discreetly.</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">6+ weeks</p>
                <p className="text-sm md:text-base text-muted-foreground mt-2">The traditional Omugwo period. We can cover the full window, or step in when grandma needs to rest or return home.</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">Gift it</p>
                <p className="text-sm md:text-base text-muted-foreground mt-2">Diaspora families regularly gift Omugwo packages to sisters and daughters in Lagos. We coordinate everything and send WhatsApp updates.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Omugwo Care in Lagos — What's Included (SEO content block) */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card border border-border/50 p-6 md:p-10 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Omugwo Care in Lagos — What's Included</h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6 max-w-3xl">
              Our Omugwo and postnatal care service in Lagos brings a trained Care Specialist into your home for the traditional 6+ week recovery window. Every placement is vetted, insured, and supervised by Medic Connect. Families across Lekki, Ikoyi, Victoria Island, Ikeja, Yaba, and the mainland book us for:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
              {[
                "Newborn bathing, cord and nappy care",
                "Breastfeeding and lactation support",
                "Overnight feeds so Mama can sleep",
                "Cooking nourishing postpartum meals (pepper soup, ofe nsala, hot drinks)",
                "Light housekeeping focused on Mama and baby",
                "Quiet screening for postnatal depression and anaemia",
                "Infant CPR and emergency response training",
                "Daily WhatsApp updates for diaspora family members",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm md:text-base">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who We Support */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-border/50 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-8 text-center">Who We Support</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {whoWeSupport.map((item, index) => <div key={item} className="interactive-list-item">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>)}
            </div>
          </div>
        </section>

        {/* Our Approach - Four Pillars */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Our Approach</h2>
            <p className="text-lg text-muted-foreground">Our postnatal care is built on four pillars</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((pillar, index) => <HoverCard key={pillar.title} {...pillar} index={index} />)}
          </div>
        </section>

        {/* Sample Schedules - Tabs */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Sample Schedules</h2>
          </div>

          <div className="max-w-3xl mx-auto animate-slide-up">
            <Tabs defaultValue="daytime" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-full p-1 bg-muted mb-8">
                <TabsTrigger value="daytime" className="rounded-full flex items-center gap-2 data-[state=active]:bg-card">
                  <Sun className="w-4 h-4" />
                  Daytime Care
                </TabsTrigger>
                <TabsTrigger value="overnight" className="rounded-full flex items-center gap-2 data-[state=active]:bg-card">
                  <Moon className="w-4 h-4" />
                  Overnight Care
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="daytime" className="kit-curve bg-card p-6 border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Time</TableHead>
                      <TableHead>Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daytimeSchedule.map(row => <TableRow key={row.time} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium text-sm">{row.time}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.activity}</TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="overnight" className="kit-curve bg-card p-6 border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Time</TableHead>
                      <TableHead>Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overnightSchedule.map(row => <TableRow key={row.time} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium text-sm">{row.time}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.activity}</TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Care Specialists */}
        <section className="py-12 md:py-16">
          <div className="kit-curve md:kit-curve-lg bg-muted p-5 md:p-12 animate-slide-up">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-2 md:mb-4 text-center">Our Care Specialists</h2>
              <p className="text-center text-muted-foreground text-sm md:text-base mb-6 md:mb-8">Trained and certified nurses, doulas, and perinatal support workers.</p>
              
              <Tabs defaultValue="qualifications" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-full p-1 bg-card mb-5 md:mb-8 max-w-xs md:max-w-md mx-auto h-10 md:h-11">
                  <TabsTrigger value="qualifications" className="rounded-full flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                    <Shield className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    Qualifications
                  </TabsTrigger>
                  <TabsTrigger value="matching" className="rounded-full flex items-center justify-center gap-1.5 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                    <UserCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    Your Match
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="qualifications" className="rounded-xl md:kit-curve bg-card p-4 md:p-8 border border-border/50 animate-fade-in">
                  <div className="grid gap-2 md:gap-4 sm:grid-cols-2">
                    {qualifications.map((q, index) => <div key={q} className="flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl bg-muted/50 hover:bg-muted transition-colors group" style={{
                    animationDelay: `${index * 50}ms`
                  }}>
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/30 transition-colors">
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent" />
                        </div>
                        <span className="text-xs md:text-sm font-medium leading-relaxed">{q}</span>
                      </div>)}
                  </div>
                </TabsContent>
                
                <TabsContent value="matching" className="rounded-xl md:kit-curve bg-card p-4 md:p-8 border border-border/50 animate-fade-in">
                  <div className="space-y-3 md:space-y-6">
                    <div className="flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl bg-muted/50">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base mb-0.5 md:mb-1">Personalized Matching</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">We find experts with diverse backgrounds to fit your specific needs.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl bg-muted/50">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base mb-0.5 md:mb-1">Risk-Free Process</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">Full refund if we can't find the right match, no questions asked.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl bg-muted/50">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Baby className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm md:text-base mb-0.5 md:mb-1">Meet Before You Commit</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">We arrange introductions so you can confirm fit before care begins.</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section className="py-10 md:py-12">
          <div className="kit-curve-lg bg-card p-8 md:p-12 border border-border/50 animate-slide-up">
            <h2 className="text-2xl font-bold tracking-tight mb-6 text-center">Recommended Add-On Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {addOns.map(addon => <div key={addon} className="interactive-list-item">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm font-medium">{addon}</span>
                </div>)}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Our Journey Together</h2>
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

        {/* FAQ */}
        <section className="py-10 md:py-12">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-[26px] sm:text-[34px] font-medium tracking-[-0.02em] text-ink mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="max-w-3xl mx-auto kit-curve bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
            <Accordion type="single" collapsible>
              {faqs.map((faq, index) => <AccordionItem key={index} value={`faq-${index}`} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-4 text-left">
                    <span className="font-semibold pr-4">{faq.q}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>)}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <CTASection headline="Ready to experience the Omugwo you deserve?" body="Let us support you through your postpartum journey with professional, compassionate care." />
      </main>

      <Footer />
    </div>;
};
export default PostnatalCare;