import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CareRequestDialog from "@/components/CareRequestDialog";
import { KitMain, kitInput, kitPrimaryButton } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { EmergencyBox, NotchTag, Watermark } from "@/components/mc/brand";
import { SectionHead } from "@/components/mc/service-sections";
import { art } from "@/components/mc/art";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackContactForm } from "@/lib/measurement";
import { cn } from "@/lib/utils";

/**
 * Contact: the three ways to reach us hang from the hero, then the three
 * doors (care, facilities, work) so most people go straight to the right
 * form, and a general message form for everything else.
 */
const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().min(1, "Phone is required").max(20, "Phone must be less than 20 characters").regex(/^[0-9+\-\s()]+$/, "Invalid phone format"),
  service: z.string().min(1, "Please select a service"),
  message: z.string().trim().min(1, "Message is required").max(1000, "Message must be less than 1000 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const MedicContact = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const result = contactFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof ContactFormData;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }
    
    const { error } = await supabase.from("contact_submissions").insert({
      name: result.data.name,
      email: result.data.email,
      phone: result.data.phone,
      service: result.data.service,
      message: result.data.message,
    });

    if (error) {
      // Avoid logging detailed error info in production to prevent information leakage
      if (import.meta.env.DEV) {
        console.error("Error submitting contact form:", error);
      }
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    // Send email notification
    supabase.functions.invoke("send-form-notification", {
      body: {
        formType: "contact",
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          service: result.data.service,
          message: result.data.message,
        },
      },
    }).catch(err => {
      // Only log in development to prevent information leakage
      if (import.meta.env.DEV) {
        console.error("Email notification failed:", err);
      }
    });

    toast.success("Message sent! We'll get back to you soon.");
    trackContactForm("contact_page");
    setFormData({ name: "", email: "", phone: "", service: "", message: "" });
    setErrors({});
    setIsSubmitting(false);
  };
  const channels = [
    { label: "WhatsApp (preferred)", value: "+234 812 698 8237", href: "https://wa.me/2348126988237", icon: art.objChatCall },
    { label: "Call", value: "+234 812 698 8237", href: "tel:+2348126988237", icon: art.iconPhone },
    { label: "Email", value: "hello@medicconnect.co", href: "mailto:hello@medicconnect.co", icon: art.iconEmail },
  ];

  const serviceOptions = [
    { value: "home-care", label: "Home Care" },
    { value: "postnatal", label: "Postnatal/Omugwo" },
    { value: "childcare", label: "Childcare" },
    { value: "eldercare", label: "Eldercare" },
    { value: "pediatric", label: "Pediatric/Special Needs" },
    { value: "staffing", label: "Hospital Staffing" },
    { value: "support", label: "Hospital Support" },
    { value: "other", label: "Other" },
  ];

  const doorClass = "mc-tilt group flex h-full flex-col gap-2 border-2 border-navy bg-white p-5 text-left";
  const doorInner = (title: string, text: string, cta: string, src: string) => (
    <>
      <div className="relative mb-2 h-[120px] bg-tint">
        <img src={src} alt="" loading="lazy" className="absolute inset-x-0 bottom-0 mx-auto h-[108px] object-contain" />
      </div>
      <h3 className="text-[20px] leading-[1.15] tracking-[-0.035em]">{title}</h3>
      <p className="text-[15px] leading-[1.55] text-body">{text}</p>
      <span className="mt-auto pt-2 text-[15px] font-extrabold text-brand group-hover:text-navy">
        {cta} <span aria-hidden="true">→</span>
      </span>
    </>
  );

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Contact Medic Connect | Lagos Healthcare Support" description="Get in touch with Medic Connect - hello@medicconnect.co or +234 812 698 8237. Care for families, staffing for institutions." path="/contact" />
      <MedicHeader />

      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
        <Watermark glyph="o" size={520} opacity={0.12} className="-right-[160px] -top-[80px]" />
        <div className="relative mx-auto max-w-[1440px] px-[22px] pb-[150px] sm:px-[50px] lg:pb-[150px]">
          <div className="max-w-[64%] lg:max-w-[720px]">
            <p className="eyebrow !text-brand-soft">Contact</p>
            <div className="mt-3 lg:mt-4">
              <KitPillHeading text="Talk to a care coordinator." accent={[3]} align="left" />
            </div>
            <p className="mt-5 text-[15px] leading-[1.55] text-body-navy sm:text-[18px] lg:max-w-[48ch] lg:text-[20px]">
              Tell us what you need and we will come back with the right team, usually the same working day.
            </p>
          </div>
          <img
            src={art.coordinatorDeskPhone}
            alt=""
            className="pointer-events-none absolute bottom-[100px] right-3 h-[150px] max-w-[38%] object-contain object-right-bottom sm:right-[40px] sm:h-[210px] lg:bottom-[110px] lg:right-[100px] lg:h-[300px] lg:max-w-none"
          />
        </div>
      </section>

      <KitMain className="relative -mt-[110px] pt-0 lg:-mt-[100px]">
        {/* The three ways to reach us, hanging from the hero. */}
        <section aria-label="Ways to reach us">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-7">
            {channels.map((c, i) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{ ["--mc-tilt" as string]: `${[-1.1, 0.9, -0.7][i]}deg` }}
                  className={cn(
                    "mc-tilt flex items-center gap-4 border-2 border-navy px-5 py-4 transition-colors hover:bg-tint lg:px-6 lg:py-5",
                    i === 0 ? "bg-white shadow-offset" : i === 1 ? "bg-tint shadow-offset" : "bg-white shadow-offset-blue",
                  )}
                >
                  <img src={c.icon} alt="" className="h-11 w-11 shrink-0 object-contain" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand">{c.label}</span>
                    <span className="block truncate text-[18px] font-black tracking-[-0.02em] text-navy lg:text-[20px]">{c.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Most people are best served by one of the three doors. */}
        <section aria-labelledby="doors-heading" className="mt-20 lg:mt-28">
          <SectionHead id="doors-heading" eyebrow="The quickest route" title="What do you need?" />
          <ul className="grid gap-5 sm:grid-cols-3 lg:gap-7">
            <li style={{ ["--mc-tilt" as string]: "-1deg" }} className="mc-tilt">
              <CareRequestDialog
                source="contact"
                trigger={
                  <button type="button" className={cn(doorClass, "w-full shadow-offset")}>
                    {doorInner("Care for my family", "Nurses, carers, nannies and postnatal support at home.", "Request care", art.familyDoorNurse)}
                  </button>
                }
              />
            </li>
            <li>
              <Link to="/for-facilities" style={{ ["--mc-tilt" as string]: "0.8deg" }} className={cn(doorClass, "shadow-offset-blue")}>
                {doorInner("Staff for my facility", "Clinical and support staff for hospitals, clinics and companies.", "Tell us the rota gap", art.hospitalManagerClipboard)}
              </Link>
            </li>
            <li>
              <Link to="/join" style={{ ["--mc-tilt" as string]: "-0.6deg" }} className={cn(doorClass, "shadow-offset")}>
                {doorInner("Work with Medic Connect", "Nurses, carers and professionals joining the network.", "Join the network", art.nursingStudentTextbooks)}
              </Link>
            </li>
          </ul>
        </section>

        {/* Everything else: the general message form beside the details. */}
        <section aria-labelledby="message-heading" className="mt-20 lg:mt-28">
          <SectionHead id="message-heading" eyebrow="Anything else" title="Send us a message" />
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <form onSubmit={handleSubmit} className="border-2 border-navy bg-white p-6 shadow-offset sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="label-caps block text-label">Your name</label>
                <input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  maxLength={100}
                  className={`${kitInput} ${errors.name ? "border-destructive" : ""}`}
                />
                {errors.name && <p className="mt-1 text-[13px] text-destructive">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="contact-email" className="label-caps block text-label">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  maxLength={255}
                  className={`${kitInput} ${errors.email ? "border-destructive" : ""}`}
                />
                {errors.email && <p className="mt-1 text-[13px] text-destructive">{errors.email}</p>}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="contact-phone" className="label-caps block text-label">Phone</label>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                maxLength={20}
                className={`${kitInput} ${errors.phone ? "border-destructive" : ""}`}
              />
              {errors.phone && <p className="mt-1 text-[13px] text-destructive">{errors.phone}</p>}
            </div>

            <div className="mt-5">
              <label htmlFor="contact-service" className="label-caps block text-label">What do you need help with?</label>
              <Select value={formData.service} onValueChange={(value) => handleInputChange("service", value)}>
                <SelectTrigger
                  id="contact-service"
                  aria-label="Service needed"
                  className={`mt-2 h-auto rounded-none border-input bg-white px-4 py-3 text-[16px] text-ink focus:border-brand ${errors.service ? "border-destructive" : ""}`}
                >
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {serviceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.service && <p className="mt-1 text-[13px] text-destructive">{errors.service}</p>}
            </div>

            <div className="mt-5">
              <label htmlFor="contact-message" className="label-caps block text-label">Message</label>
              <textarea
                id="contact-message"
                name="message"
                value={formData.message}
                onChange={(e) => handleInputChange("message", e.target.value)}
                maxLength={1000}
                rows={5}
                className={`${kitInput} min-h-[140px] ${errors.message ? "border-destructive" : ""}`}
              />
              {errors.message && <p className="mt-1 text-[13px] text-destructive">{errors.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className={`${kitPrimaryButton} mt-7 w-full disabled:opacity-60`}>
              {isSubmitting ? "Sending" : "Send message"}
            </button>
          </form>
            <aside className="flex flex-col gap-6">
              <div className="relative border-2 border-navy bg-white p-6 pt-8">
                <NotchTag tone="blue" size="sm" className="absolute -top-3 left-6">
                  Visit us
                </NotchTag>
                <p className="text-[17px] font-extrabold leading-[1.4] text-navy">145 Igbosere Road, Lagos Island, Nigeria</p>
              </div>
              <div className="relative border-2 border-navy bg-tint p-6 pt-8">
                <NotchTag tone="tint" outlined size="sm" className="absolute -top-3 left-6">
                  Office hours
                </NotchTag>
                <ul className="space-y-2 text-[16px] font-bold text-navy">
                  <li>Monday to Friday: 8:00 to 18:00</li>
                  <li>Saturday: 9:00 to 14:00</li>
                  <li>Emergency support 24/7 on WhatsApp</li>
                </ul>
              </div>
              <EmergencyBox />
            </aside>
          </div>
        </section>
      </KitMain>

      <Footer />
    </div>
  );
};

export default MedicContact;
