import { useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { attributionColumns } from "@/lib/utm";
import { trackCreatorApplication } from "@/lib/measurement";
import { cn } from "@/lib/utils";
import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import KitPageHero from "@/components/kit/KitPageHero";
import { art } from "@/components/mc/art";
import { NotchTag, Tape } from "@/components/mc/brand";
import { SectionHead, Tick } from "@/components/mc/service-sections";
import { KitMain, kitHeroPrimaryButton, kitInput, kitPrimaryButton, kitSecondaryButton } from "@/components/kit/KitLayout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, MessageCircle, Upload } from "lucide-react";

const COUNTRY_CODES = [
  { code: "+213", country: "Algeria", flag: "🇩🇿" },
  { code: "+244", country: "Angola", flag: "🇦🇴" },
  { code: "+229", country: "Benin", flag: "🇧🇯" },
  { code: "+267", country: "Botswana", flag: "🇧🇼" },
  { code: "+226", country: "Burkina Faso", flag: "🇧🇫" },
  { code: "+257", country: "Burundi", flag: "🇧🇮" },
  { code: "+238", country: "Cabo Verde", flag: "🇨🇻" },
  { code: "+237", country: "Cameroon", flag: "🇨🇲" },
  { code: "+236", country: "Central African Republic", flag: "🇨🇫" },
  { code: "+235", country: "Chad", flag: "🇹🇩" },
  { code: "+269", country: "Comoros", flag: "🇰🇲" },
  { code: "+242", country: "Congo", flag: "🇨🇬" },
  { code: "+225", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "+243", country: "DR Congo", flag: "🇨🇩" },
  { code: "+253", country: "Djibouti", flag: "🇩🇯" },
  { code: "+20", country: "Egypt", flag: "🇪🇬" },
  { code: "+240", country: "Equatorial Guinea", flag: "🇬🇶" },
  { code: "+291", country: "Eritrea", flag: "🇪🇷" },
  { code: "+268", country: "Eswatini", flag: "🇸🇿" },
  { code: "+251", country: "Ethiopia", flag: "🇪🇹" },
  { code: "+241", country: "Gabon", flag: "🇬🇦" },
  { code: "+220", country: "Gambia", flag: "🇬🇲" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+224", country: "Guinea", flag: "🇬🇳" },
  { code: "+245", country: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+266", country: "Lesotho", flag: "🇱🇸" },
  { code: "+231", country: "Liberia", flag: "🇱🇷" },
  { code: "+218", country: "Libya", flag: "🇱🇾" },
  { code: "+261", country: "Madagascar", flag: "🇲🇬" },
  { code: "+265", country: "Malawi", flag: "🇲🇼" },
  { code: "+223", country: "Mali", flag: "🇲🇱" },
  { code: "+222", country: "Mauritania", flag: "🇲🇷" },
  { code: "+230", country: "Mauritius", flag: "🇲🇺" },
  { code: "+212", country: "Morocco", flag: "🇲🇦" },
  { code: "+258", country: "Mozambique", flag: "🇲🇿" },
  { code: "+264", country: "Namibia", flag: "🇳🇦" },
  { code: "+227", country: "Niger", flag: "🇳🇪" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+250", country: "Rwanda", flag: "🇷🇼" },
  { code: "+239", country: "São Tomé and Príncipe", flag: "🇸🇹" },
  { code: "+221", country: "Senegal", flag: "🇸🇳" },
  { code: "+248", country: "Seychelles", flag: "🇸🇨" },
  { code: "+232", country: "Sierra Leone", flag: "🇸🇱" },
  { code: "+252", country: "Somalia", flag: "🇸🇴" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+211", country: "South Sudan", flag: "🇸🇸" },
  { code: "+249", country: "Sudan", flag: "🇸🇩" },
  { code: "+255", country: "Tanzania", flag: "🇹🇿" },
  { code: "+228", country: "Togo", flag: "🇹🇬" },
  { code: "+216", country: "Tunisia", flag: "🇹🇳" },
  { code: "+256", country: "Uganda", flag: "🇺🇬" },
  { code: "+260", country: "Zambia", flag: "🇿🇲" },
  { code: "+263", country: "Zimbabwe", flag: "🇿🇼" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+1", country: "United States", flag: "🇺🇸" },
];

const AFRICAN_COUNTRIES = [
  ...COUNTRY_CODES.filter(c => !["United Kingdom", "United States"].includes(c.country)).map(c => c.country),
  "Other",
];

const SAFE_URL_REGEX = /^https?:\/\/.+/i;

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const creatorFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name").max(100),
  email: z.string().trim().min(1, "Enter your email address").email("Check your email address").max(255),
  phone: z.string().trim().min(1, "Enter your phone number").max(20).regex(/^[0-9+\-\s()]+$/, "Use numbers only"),
  country: z.string().trim().min(1, "Choose your country").max(100),
  socialLinks: z.string().trim().min(1, "Add at least one link").max(1000),
  message: z.string().trim().min(1, "Tell us a little about why").max(1000),
});

type CreatorFormData = z.infer<typeof creatorFormSchema>;

/** A field label in the site's small capitals, with its error underneath. */
const Field = ({ id, label, error, children, className }: { id?: string; label: string; error?: string; children: ReactNode; className?: string }) => (
  <div className={className}>
    <label htmlFor={id} className="label-caps block text-label">{label}</label>
    {children}
    {error && <p className="mt-1 text-[13px] text-destructive">{error}</p>}
  </div>
);

/** Portfolio or rate card: a link, or a file to upload. */
const LinkOrFile = ({
  label, mode, onMode, link, onLink, file, onFile, placeholder,
}: {
  label: string;
  mode: "link" | "upload";
  onMode: (m: "link" | "upload") => void;
  link: string;
  onLink: (v: string) => void;
  file: File | null;
  onFile: (f: File | null) => void;
  placeholder: string;
}) => (
  <fieldset>
    <legend className="label-caps block text-label">{label}</legend>
    <div role="radiogroup" aria-label={`${label}: link or upload`} className="mt-2 grid grid-cols-2 border-[1.5px] border-navy">
      {(["link", "upload"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onMode(m)}
          className={cn(
            "min-h-[40px] text-[14px] font-extrabold transition-colors",
            mode === m ? "bg-navy text-white" : "bg-white text-navy hover:bg-tint",
          )}
        >
          {m === "link" ? "Link" : "Upload a file"}
        </button>
      ))}
    </div>
    {mode === "link" ? (
      <input type="url" aria-label={`${label} link`} placeholder={placeholder} value={link} onChange={(e) => onLink(e.target.value)} className={kitInput} />
    ) : (
      <label className="kit-curve-sm mt-2 flex min-h-[50px] cursor-pointer items-center gap-2 border-[1.5px] border-dashed border-input bg-white px-4 text-[15px] text-body transition-colors hover:border-brand hover:text-navy">
        <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{file ? file.name : "Choose a file (PDF, slides, document or image)"}</span>
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
      </label>
    )}
  </fieldset>
);

const Creator = () => {
  const [formData, setFormData] = useState<CreatorFormData>({
    name: "", email: "", phone: "", country: "", socialLinks: "", message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreatorFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryCode, setCountryCode] = useState("+234");
  const [codeOpen, setCodeOpen] = useState(false);

  // Portfolio state
  const [portfolioMode, setPortfolioMode] = useState<"link" | "upload">("link");
  const [portfolioLink, setPortfolioLink] = useState("");
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);

  // Rate card state
  const [rateCardMode, setRateCardMode] = useState<"link" | "upload">("link");
  const [rateCardLink, setRateCardLink] = useState("");
  const [rateCardFile, setRateCardFile] = useState<File | null>(null);

  const handleInputChange = (field: keyof CreatorFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("creator-uploads").upload(path, file);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("creator-uploads").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = creatorFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CreatorFormData, string>> = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof CreatorFormData;
        fieldErrors[field] ??= err.message;
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    // Validate portfolio
    let portfolioUrl: string | null = null;
    if (portfolioMode === "upload") {
      if (!portfolioFile) {
        toast.error("Please upload your portfolio.");
        setIsSubmitting(false);
        return;
      }
      portfolioUrl = await uploadFile(portfolioFile, "portfolios");
      if (!portfolioUrl) {
        toast.error("Failed to upload portfolio file. Please try again.");
        setIsSubmitting(false);
        return;
      }
    } else {
      if (!portfolioLink.trim()) {
        toast.error("Please provide a link to your portfolio.");
        setIsSubmitting(false);
        return;
      }
      if (!isSafeUrl(portfolioLink.trim())) {
        toast.error("Portfolio link must be a valid URL starting with https:// or http://");
        setIsSubmitting(false);
        return;
      }
      portfolioUrl = portfolioLink.trim();
    }

    // Validate rate card
    let rateCardUrl: string | null = null;
    if (rateCardMode === "upload") {
      if (!rateCardFile) {
        toast.error("Please upload your rate card.");
        setIsSubmitting(false);
        return;
      }
      rateCardUrl = await uploadFile(rateCardFile, "rate-cards");
      if (!rateCardUrl) {
        toast.error("Failed to upload rate card file. Please try again.");
        setIsSubmitting(false);
        return;
      }
    } else {
      if (!rateCardLink.trim()) {
        toast.error("Please provide a link to your rate card.");
        setIsSubmitting(false);
        return;
      }
      if (!isSafeUrl(rateCardLink.trim())) {
        toast.error("Rate card link must be a valid URL starting with https:// or http://");
        setIsSubmitting(false);
        return;
      }
      rateCardUrl = rateCardLink.trim();
    }

    const { error } = await supabase.from("creator_applications").insert({
      name: result.data.name,
      email: result.data.email,
      phone: `${countryCode} ${result.data.phone}`,
      country: result.data.country,
      social_links: result.data.socialLinks,
      portfolio_url: portfolioUrl,
      rate_card_url: rateCardUrl,
      message: result.data.message,
      ...attributionColumns(),
    });

    if (error) {
      if (import.meta.env.DEV) console.error("Error submitting:", error);
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    trackCreatorApplication();
    // Send email notification (fire-and-forget)
    supabase.functions.invoke("send-form-notification", {
      body: {
        formType: "creator_application",
        data: {
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone,
          country: result.data.country,
          socialLinks: result.data.socialLinks,
          portfolioUrl,
          rateCardUrl,
          message: result.data.message,
        },
      },
    }).catch(err => {
      if (import.meta.env.DEV) console.error("Notification failed:", err);
    });

    toast.success("Application submitted! We'll be in touch soon.");
    setFormData({ name: "", email: "", phone: "", country: "", socialLinks: "", message: "" });
    setPortfolioLink("");
    setPortfolioFile(null);
    setRateCardLink("");
    setRateCardFile(null);
    setErrors({});
    setIsSubmitting(false);
  };

  const criteria = [
    "Create content that educates, informs, or inspires around health and wellness",
    "Are active on Instagram, TikTok, LinkedIn, or YouTube",
    "Have an engaged, trusting audience",
  ];

  const benefits = [
    { title: "Paid partnerships", description: "Per post fees and monthly retainer options for consistent, quality collaboration.", src: art.objPriceTagNaira, tilt: "-1deg", shadow: "shadow-offset" },
    { title: "Long-term collaboration", description: "Grow alongside a Pan-African healthcare brand that's just getting started.", src: art.objHandshake, tilt: "0.8deg", shadow: "shadow-offset-blue" },
    { title: "Meaningful impact", description: "Contribute to something that genuinely changes lives across Africa.", src: art.objHandsHeart, tilt: "-0.6deg", shadow: "shadow-offset" },
  ];

  const selectButton = "flex items-center justify-between gap-2 text-left";

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Creator Programme | Medic Connect"
        description="Join the Medic Connect Creator Programme. Paid partnerships for healthcare, wellness, and lifestyle creators across Africa and the diaspora."
        path="/creator"
      />
      <MedicHeader />
      <KitPageHero
        eyebrow="Creator programme"
        title="Tell the story of care at home"
        accent={[4]}
        art={art.nurseFilmingExplainer}
        lead="Paid partnerships for creators who want to help families across Africa find professional, trusted care."
      >
        <a href="#apply" className={kitHeroPrimaryButton}>Apply now</a>
      </KitPageHero>
      <KitMain>

        {/* Who we are, what creators do, and who fits, side by side. */}
        <section aria-labelledby="about-heading" className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-16">
          <div>
            <SectionHead id="about-heading" eyebrow="The programme" title="Who we are" />
            <p className="max-w-[62ch] text-[17px] leading-[1.7] text-body">
              Medic Connect is Africa's healthcare operating system, the infrastructure connecting families, caregivers, and healthcare professionals across the continent. From clinical home care to eldercare, postnatal support to staffing, we are redefining how Africa experiences healthcare.
            </p>
            <p className="mt-4 text-[17px] font-extrabold text-navy">Now we're looking for creators to help tell that story.</p>
            <h3 className="mt-10 text-[24px] leading-[1.1] tracking-[-0.04em] sm:text-[28px]">What you will do</h3>
            <p className="mt-3 max-w-[62ch] text-[17px] leading-[1.7] text-body">
              Create authentic, purposeful content that builds awareness and trust around professional healthcare at home, in your voice, on your platform, for an audience that needs to hear it.
            </p>
          </div>
          <div className="relative border-2 border-navy bg-white p-6 shadow-offset sm:p-8 lg:mt-[76px]">
            <Tape width={90} tilt={3} className="-top-3 right-10" />
            <h3 className="text-[22px] leading-[1.15] tracking-[-0.035em] sm:text-[26px]">Who we are looking for</h3>
            <p className="mt-3 text-[16px] leading-[1.65] text-body">
              Credible, passionate creators (healthcare professionals, wellness advocates, lifestyle creators, and students) who understand the importance of healthcare access in Africa and want to use their platform meaningfully.
            </p>
            <p className="label-caps mt-6 text-label">You're a strong fit if you</p>
            <ul className="mt-3 space-y-3">
              {criteria.map((item) => (
                <li key={item} className="flex gap-3 text-[16px] leading-[1.6] text-ink">
                  <Tick />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What you get */}
        <section aria-labelledby="benefits-heading" className="mt-20 lg:mt-28">
          <SectionHead id="benefits-heading" title="What you get" />
          <ul className="grid gap-6 sm:grid-cols-3 lg:gap-8">
            {benefits.map((b) => (
              <li
                key={b.title}
                style={{ ["--mc-tilt" as string]: b.tilt }}
                className={cn("mc-tilt flex h-full flex-col gap-2 border-2 border-navy bg-white p-5", b.shadow)}
              >
                <div className="relative mb-2 grid h-[120px] place-items-center bg-tint">
                  <img src={b.src} alt="" loading="lazy" className="h-[92px] w-auto object-contain" />
                </div>
                <h3 className="text-[20px] leading-[1.15] tracking-[-0.035em]">{b.title}</h3>
                <p className="text-[15px] leading-[1.55] text-body">{b.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Application form, with what to have ready and a way to ask. */}
        <section id="apply" aria-labelledby="apply-heading" className="mt-20 scroll-mt-28 lg:mt-28">
          <SectionHead id="apply-heading" eyebrow="Apply" title="Apply now" intro="It takes about five minutes. We reply to every application." />
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
            <form onSubmit={handleSubmit} noValidate className="border-2 border-navy bg-white p-6 shadow-offset sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="creator-name" label="Full name" error={errors.name}>
                  <input
                    id="creator-name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    maxLength={100}
                    className={cn(kitInput, errors.name && "border-destructive")}
                  />
                </Field>
                <Field id="creator-email" label="Email" error={errors.email}>
                  <input
                    id="creator-email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    maxLength={255}
                    className={cn(kitInput, errors.email && "border-destructive")}
                  />
                </Field>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field id="creator-phone" label="Phone" error={errors.phone}>
                  <div className="flex gap-2">
                    <Popover open={codeOpen} onOpenChange={setCodeOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          role="combobox"
                          aria-expanded={codeOpen}
                          aria-label={`Country code ${countryCode}`}
                          className={cn(kitInput, selectButton, "w-[112px] shrink-0 px-3")}
                        >
                          <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag} {countryCode}</span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 text-label" aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="z-50 w-[260px] rounded-none border-2 border-navy bg-background p-0">
                        <Command>
                          <CommandInput placeholder="Search country" />
                          <CommandList>
                            <CommandEmpty>No country found.</CommandEmpty>
                            <CommandGroup>
                              {COUNTRY_CODES.map((c) => (
                                <CommandItem
                                  key={c.code + c.country}
                                  value={c.country}
                                  onSelect={() => {
                                    setCountryCode(c.code);
                                    setCodeOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${countryCode === c.code ? "opacity-100" : "opacity-0"}`} />
                                  {c.flag} {c.country} ({c.code})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <input
                      id="creator-phone"
                      type="tel"
                      autoComplete="tel-national"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      maxLength={20}
                      className={cn(kitInput, "min-w-0 flex-1", errors.phone && "border-destructive")}
                    />
                  </div>
                </Field>
                <Field id="creator-country" label="Country" error={errors.country}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        id="creator-country"
                        type="button"
                        role="combobox"
                        className={cn(kitInput, selectButton, !formData.country && "text-label", errors.country && "border-destructive")}
                      >
                        <span className="truncate">{formData.country || "Choose a country"}</span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-label" aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="z-50 w-[--radix-popover-trigger-width] rounded-none border-2 border-navy bg-background p-0">
                      <Command>
                        <CommandInput placeholder="Search country" />
                        <CommandList>
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {AFRICAN_COUNTRIES.map((country) => (
                              <CommandItem
                                key={country}
                                value={country}
                                onSelect={() => handleInputChange("country", country)}
                              >
                                <Check className={`mr-2 h-4 w-4 ${formData.country === country ? "opacity-100" : "opacity-0"}`} />
                                {country}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </Field>
              </div>

              <Field id="creator-social" label="Your social media profiles" error={errors.socialLinks} className="mt-5">
                <textarea
                  id="creator-social"
                  placeholder="One link per line"
                  value={formData.socialLinks}
                  onChange={(e) => handleInputChange("socialLinks", e.target.value)}
                  maxLength={1000}
                  className={cn(kitInput, "min-h-[96px]", errors.socialLinks && "border-destructive")}
                />
              </Field>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <LinkOrFile
                  label="Portfolio"
                  mode={portfolioMode}
                  onMode={setPortfolioMode}
                  link={portfolioLink}
                  onLink={setPortfolioLink}
                  file={portfolioFile}
                  onFile={setPortfolioFile}
                  placeholder="https://yourportfolio.com"
                />
                <LinkOrFile
                  label="Rate card"
                  mode={rateCardMode}
                  onMode={setRateCardMode}
                  link={rateCardLink}
                  onLink={setRateCardLink}
                  file={rateCardFile}
                  onFile={setRateCardFile}
                  placeholder="https://yourratecard.com"
                />
              </div>

              <Field id="creator-message" label="Why do you want to work with Medic Connect?" error={errors.message} className="mt-5">
                <textarea
                  id="creator-message"
                  value={formData.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  maxLength={1000}
                  className={cn(kitInput, "min-h-[140px]", errors.message && "border-destructive")}
                />
              </Field>

              <button type="submit" disabled={isSubmitting} className={cn(kitPrimaryButton, "mt-7 w-full disabled:opacity-60")}>
                {isSubmitting ? "Sending" : "Send application"}
              </button>
            </form>

            <aside className="flex flex-col gap-6">
              <div className="relative border-2 border-navy bg-white p-6 pt-8">
                <NotchTag tone="blue" size="sm" className="absolute -top-3 left-6">
                  Have these ready
                </NotchTag>
                <ul className="space-y-3 text-[16px] leading-[1.5] text-ink">
                  {["Links to your social media profiles", "Your portfolio, as a link or a file", "Your rate card, as a link or a file"].map((item) => (
                    <li key={item} className="flex gap-3">
                      <Tick />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative border-2 border-navy bg-tint p-6 pt-8">
                <NotchTag tone="tint" outlined size="sm" className="absolute -top-3 left-6">
                  Have questions?
                </NotchTag>
                <p className="text-[16px] leading-[1.6] text-navy">Message the team. We're happy to tell you more about the creator programme.</p>
                <a href="https://wa.me/2348126988237" className={cn(kitSecondaryButton, "mt-5 w-full")}>
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  WhatsApp us
                </a>
              </div>
            </aside>
          </div>
        </section>
      </KitMain>
      <Footer />
    </div>
  );
};

export default Creator;
