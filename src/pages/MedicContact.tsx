import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import AudienceHero from "@/components/home/AudienceHero";
import {
  KitMain,
  KitSection,
  KitPanel,
  kitInput,
  kitPrimaryButton,
  kitHeroPrimaryButton,
  kitHeroSecondaryButton,
} from "@/components/kit/KitLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackContactForm } from "@/lib/measurement";
import KitPillHeading from "@/components/kit/KitPillHeading";

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
  const contactInfo = [
    { icon: MessageCircle, label: "WhatsApp (preferred)", value: "+234 812 698 8237", href: "https://wa.me/2348126988237" },
    { icon: Phone, label: "Phone", value: "+234 812 698 8237" },
    { icon: Mail, label: "Email", value: "hello@medicconnect.co", href: "mailto:hello@medicconnect.co" },
    { icon: MapPin, label: "Address", value: "145 Igbosere Road, Lagos Island, Nigeria" },
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

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title="Contact Medic Connect | Lagos Healthcare Support" description="Get in touch with Medic Connect - hello@medicconnect.co or +234 812 698 8237. Care for families, staffing for institutions." path="/contact" />
      <MedicHeader />

      <AudienceHero variant="centred">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="eyebrow text-muted-navy">Contact</p>
          <KitPillHeading text="Talk to a care coordinator" accent={[0]} align="centre" className="mt-5" />
          <p className="mx-auto mt-6 max-w-[52ch] text-[18px] leading-[1.6] text-body-navy sm:text-[21px]">
            Tell us what you need and we will come back with the right team, usually the same working day.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="https://wa.me/2348126988237"
              target="_blank"
              rel="noopener noreferrer"
              className={kitHeroPrimaryButton}
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Chat on WhatsApp
            </a>
            <a href="tel:+2348126988237" className={kitHeroSecondaryButton}>
              Call +234 812 698 8237
            </a>
          </div>
        </div>
      </AudienceHero>

      <KitMain>
        <div className="grid gap-10 lg:grid-cols-[380px_1fr] lg:gap-16">
          {/* Sidebar facts */}
          <div className="space-y-6">
            <KitPanel>
              <p className="label-caps text-label">How to reach us</p>
              <ul className="mt-4 divide-y divide-hairline-warm">
                {contactInfo.map((item) => (
                  <li key={item.label} className="flex items-start gap-3 py-4">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    <div>
                      <p className="text-[13px] text-label">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="text-[16px] font-semibold text-ink transition-colors hover:text-brand">
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-[16px] font-semibold text-ink">{item.value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </KitPanel>

            <KitPanel tone="tint">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-brand" aria-hidden="true" />
                <p className="label-caps text-label">Office hours</p>
              </div>
              <div className="mt-4 space-y-2 text-[15px] leading-[1.7] text-body">
                <p>Monday to Friday: 8:00 to 18:00</p>
                <p>Saturday: 9:00 to 14:00</p>
                <p className="font-semibold text-ink">Emergency support 24/7 on WhatsApp</p>
              </div>
            </KitPanel>
          </div>

          {/* Feature form */}
          <KitSection title="Send us a message" eyebrow="Enquiry">
            <form onSubmit={handleSubmit} className="max-w-[640px]">
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
          </KitSection>
        </div>

        <CTASection
          headline="Prefer to chat?"
          body="Most of our clients reach us on WhatsApp. Tap below to start a conversation."
        />
      </KitMain>
      <Footer />
    </div>
  );
};

export default MedicContact;

