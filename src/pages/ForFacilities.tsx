import { useState } from "react";
import { toast } from "sonner";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import AudienceHero from "@/components/home/AudienceHero";
import KitFlipCard, { KitService } from "@/components/home/KitFlipCard";
import CTASection from "@/components/CTASection";
import { KitMain, KitSection } from "@/components/kit/KitLayout";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import { supabase } from "@/integrations/supabase/client";

import staffingImg from "@/assets/services/hospital-staffing-new.jpg";
import supportImg from "@/assets/services/hospital-support.jpg";
import researchImg from "@/assets/services/clinical-research-new.jpg";
import globalImg from "@/assets/hero/hospital-staffing-hero.jpg";
import KitPillHeading from "@/components/kit/KitPillHeading";

const placementServices: KitService[] = [
  {
    eyebrow: "Staffing",
    title: "Hospital and corporate staffing",
    description:
      "Vetted doctors, nurses and allied health professionals, deployed on demand. Reliable cover for healthcare facilities across Lagos.",
    href: "/hospital-staffing",
    image: staffingImg,
    back: "navy",
  },
  {
    eyebrow: "Facilities",
    title: "Hospital support services",
    description:
      "Housekeeping, laundry, waste management, pest control and security, so your clinical teams stay on clinical work.",
    href: "/hospital-support",
    image: supportImg,
    back: "brand",
  },
  {
    eyebrow: "Research",
    title: "Clinical research and support",
    description:
      "GCP trained research coordinators, data managers and support staff for pharmaceutical trials and healthcare studies across Nigeria.",
    href: "/clinical-research",
    image: researchImg,
    back: "tint",
  },
  {
    eyebrow: "International",
    title: "Medic Connect Global",
    description:
      "Healthcare staffing and support beyond Nigeria. Our international operations and partnerships.",
    href: "https://www.medicconnect.org",
    image: globalImg,
    back: "outline",
  },
];


const ForFacilities = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please add your name and a valid email address.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("contact_submissions").insert({
      name: name.trim(),
      email: email.trim(),
      phone: "",
      service: "Facility staffing enquiry",
      message: "Facility staffing enquiry raised from the For Facilities page.",
    });
    if (error) {
      toast.error("Something went wrong. Please try again.");
      setSending(false);
      return;
    }
    supabase.functions
      .invoke("send-form-notification", {
        body: {
          formType: "contact",
          data: {
            name: name.trim(),
            email: email.trim(),
            phone: "",
            service: "Facility staffing enquiry",
            message: "Facility staffing enquiry raised from the For Facilities page.",
          },
        },
      })
      .catch(() => undefined);
    toast.success("Thank you. We will be in touch shortly.");
    setName("");
    setEmail("");
    setSending(false);
  };

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title="Healthcare Staffing for Hospitals and Facilities in Lagos"
        description="Vetted nurses, doctors, allied health and support staff for hospitals, clinics and research sites across Lagos and Nigeria. Compliance checked before deployment."
        path="/for-facilities"
        jsonLd={[medicalBusinessSchema()]}
      />
      <MedicHeader />

      <AudienceHero variant="split">
        <div className="grid gap-12 lg:grid-cols-[1fr_440px] lg:items-start">
          <div className="max-w-[560px]">
            <p className="eyebrow text-muted-navy">For facilities</p>
            <KitPillHeading text="Clinical cover you can staff a rota with" accent={[1]} align="left" className="mt-4" />
            <p className="mt-5 max-w-[54ch] text-[18px] leading-[1.6] text-body-navy sm:text-[21px]">
              Nurses, doctors, allied health and support staff, checked and compliance cleared before they reach your ward.
            </p>
            <p className="mt-10 max-w-[54ch] text-[18px] leading-[1.6] text-body-navy sm:text-[21px]">
              Leave your details and a coordinator will call you back to confirm scope, shifts and compliance requirements.
            </p>
          </div>

          <form onSubmit={submit} className="kit-curve w-full bg-white p-7">
            <h2 className="text-[24px] font-semibold leading-[1.35] tracking-[-0.015em] text-ink">
              Tell us what you need
            </h2>
            <p className="mt-2 text-[15px] leading-[1.65] text-body">
              Leave your details and a coordinator will call you back.
            </p>
            <label className="label-caps mt-6 block text-label" htmlFor="ff-name">
              Your name
            </label>
            <input
              id="ff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full border border-input bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-brand"
              autoComplete="name"
            />
            <label className="label-caps mt-5 block text-label" htmlFor="ff-email">
              Work email
            </label>
            <input
              id="ff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border border-input bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-brand"
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={sending}
              className="mt-6 w-full bg-brand px-6 py-3.5 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-navy disabled:opacity-60"
            >
              {sending ? "Sending" : "Request a call back"}
            </button>
          </form>
        </div>
      </AudienceHero>

      <KitMain>
        <KitSection eyebrow="Services" title="Placement services" intro="Permanent, locum and project cover for hospitals, clinics and research sites, compliance cleared before deployment.">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
            {placementServices.map((service) => (
              <KitFlipCard key={service.href} {...service} />
            ))}
          </div>
        </KitSection>

        <CTASection
          headline="Need cover this week?"
          body="Send us the rota gap and we will tell you what we can fill and when."
        />
      </KitMain>

      <Footer />
    </div>
  );
};

export default ForFacilities;
