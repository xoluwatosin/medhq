import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import HoverCard from "@/components/HoverCard";
import NairaIcon from "@/components/mc/NairaIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, ChevronsUpDown, Handshake, Heart, MessageCircle, Upload } from "lucide-react";

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
  name: z.string().trim().min(1, "Full name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(1, "Phone is required").max(20).regex(/^[0-9+\-\s()]+$/, "Invalid phone format"),
  country: z.string().trim().min(1, "Country is required").max(100),
  socialLinks: z.string().trim().min(1, "Social media links are required").max(1000),
  message: z.string().trim().min(1, "This field is required").max(1000),
});

type CreatorFormData = z.infer<typeof creatorFormSchema>;

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
        fieldErrors[field] = err.message;
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
    });

    if (error) {
      if (import.meta.env.DEV) console.error("Error submitting:", error);
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

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
    { title: "Paid Partnerships", description: "Per post fees and monthly retainer options for consistent, quality collaboration.", icon: NairaIcon },
    { title: "Long-term Collaboration", description: "Grow alongside a Pan-African healthcare brand that's just getting started.", icon: Handshake },
    { title: "Meaningful Impact", description: "Contribute to something that genuinely changes lives across Africa.", icon: Heart },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Creator Programme | Medic Connect"
        description="Join the Medic Connect Creator Programme. Paid partnerships for healthcare, wellness, and lifestyle creators across Africa and the diaspora."
        path="/creator"
      />
      <MedicHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {/* Hero */}
        <section className="relative kit-curve-lg overflow-hidden bg-navy mt-2 mb-8 animate-fade-in">
          <div className="p-8 md:p-12 lg:p-16 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] font-medium leading-[1.06] tracking-[-0.03em] text-white animate-slide-down">
                Medic Connect Creator Programme
              </h1>
              <p className="text-lg text-muted-foreground animate-slide-up stagger-1">
                The voice behind Africa's healthcare operating system
              </p>
            </div>
          </div>
        </section>

        {/* Who We Are */}
        <section className="mb-10 md:mb-12 max-w-3xl mx-auto animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Who We Are</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Medic Connect is Africa's healthcare operating system, the infrastructure connecting families, caregivers, and healthcare professionals across the continent. From clinical home care to eldercare, postnatal support to staffing, we are redefining how Africa experiences healthcare.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Now we're looking for creators to help tell that story.
          </p>
        </section>

        {/* Who We're Looking For */}
        <section className="mb-10 md:mb-12">
          <div className="max-w-3xl mx-auto kit-curve bg-card p-6 md:p-8 border border-hairline-warm animate-slide-up">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Who We're Looking For</h2>
            <p className="text-muted-foreground mb-6">
              We're looking for credible, passionate creators (healthcare professionals, wellness advocates, lifestyle creators, and students) who understand the importance of healthcare access in Africa and want to use their platform meaningfully.
            </p>
            <p className="font-semibold mb-4">You're a strong fit if you:</p>
            <ul className="space-y-3">
              {criteria.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What You'll Do */}
        <section className="mb-10 md:mb-12 max-w-3xl mx-auto animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">What You'll Do</h2>
          <p className="text-muted-foreground leading-relaxed">
            Create authentic, purposeful content that builds awareness and trust around professional healthcare at home, in your voice, on your platform, for an audience that needs to hear it.
          </p>
        </section>

        {/* What You Get */}
        <section className="mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center animate-slide-up">What You Get</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <HoverCard key={benefit.title} {...benefit} index={index} />
            ))}
          </div>
        </section>

        {/* Application Form */}
        <section className="mb-10 md:mb-12">
          <div className="kit-curve-lg bg-muted p-8 md:p-12 animate-slide-up">
            <h2 className="text-3xl font-bold mb-8 text-center">Apply Now</h2>
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Input
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    maxLength={100}
                    className={`rounded-xl bg-background hover:border-primary transition-colors ${errors.name ? "border-destructive" : ""}`}
                  />
                  {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
                </div>
                <div>
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    maxLength={255}
                    className={`rounded-xl bg-background hover:border-primary transition-colors ${errors.email ? "border-destructive" : ""}`}
                  />
                  {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex gap-1">
                    <Popover open={codeOpen} onOpenChange={setCodeOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-[100px] shrink-0 justify-between rounded-xl bg-background hover:border-primary transition-colors font-normal text-sm px-2"
                        >
                          {COUNTRY_CODES.find(c => c.code === countryCode)?.flag} {countryCode}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[250px] p-0 bg-background border border-border shadow-lg z-50">
                        <Command>
                          <CommandInput placeholder="Search country..." />
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
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      maxLength={20}
                      className={`rounded-xl bg-background hover:border-primary transition-colors flex-1 ${errors.phone ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={`w-full justify-between rounded-xl bg-background hover:border-primary transition-colors font-normal ${!formData.country ? "text-muted-foreground" : ""} ${errors.country ? "border-destructive" : ""}`}
                      >
                        {formData.country || "Country"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-background border border-border shadow-lg z-50">
                      <Command>
                        <CommandInput placeholder="Search country..." />
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
                  {errors.country && <p className="text-destructive text-sm mt-1">{errors.country}</p>}
                </div>
              </div>

              <div>
                <Textarea
                  placeholder="Links to your social media profiles (one per line)"
                  value={formData.socialLinks}
                  onChange={(e) => handleInputChange("socialLinks", e.target.value)}
                  maxLength={1000}
                  className={`rounded-xl min-h-[80px] bg-background hover:border-primary transition-colors ${errors.socialLinks ? "border-destructive" : ""}`}
                />
                {errors.socialLinks && <p className="text-destructive text-sm mt-1">{errors.socialLinks}</p>}
              </div>

              {/* Portfolio & Rate Card side by side */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Portfolio */}
                <div className="rounded-xl bg-background border border-input p-4 space-y-3">
                  <p className="text-sm font-medium">Portfolio</p>
                  <Tabs value={portfolioMode} onValueChange={(v) => setPortfolioMode(v as "link" | "upload")}>
                    <TabsList className="h-8 w-full">
                      <TabsTrigger value="link" className="text-xs flex-1">Link</TabsTrigger>
                      <TabsTrigger value="upload" className="text-xs flex-1">Upload</TabsTrigger>
                    </TabsList>
                    <TabsContent value="link" className="mt-2">
                      <Input
                        placeholder="https://yourportfolio.com"
                        value={portfolioLink}
                        onChange={(e) => setPortfolioLink(e.target.value)}
                        className="rounded-lg text-sm"
                      />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-input rounded-lg p-3">
                        <Upload className="w-4 h-4 shrink-0" />
                        <span className="truncate">{portfolioFile ? portfolioFile.name : "Choose file"}</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Rate Card */}
                <div className="rounded-xl bg-background border border-input p-4 space-y-3">
                  <p className="text-sm font-medium">Rate Card</p>
                  <Tabs value={rateCardMode} onValueChange={(v) => setRateCardMode(v as "link" | "upload")}>
                    <TabsList className="h-8 w-full">
                      <TabsTrigger value="link" className="text-xs flex-1">Link</TabsTrigger>
                      <TabsTrigger value="upload" className="text-xs flex-1">Upload</TabsTrigger>
                    </TabsList>
                    <TabsContent value="link" className="mt-2">
                      <Input
                        placeholder="https://yourratecard.com"
                        value={rateCardLink}
                        onChange={(e) => setRateCardLink(e.target.value)}
                        className="rounded-lg text-sm"
                      />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-input rounded-lg p-3">
                        <Upload className="w-4 h-4 shrink-0" />
                        <span className="truncate">{rateCardFile ? rateCardFile.name : "Choose file"}</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => setRateCardFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              <div>
                <Textarea
                  placeholder="Why do you want to work with Medic Connect?"
                  value={formData.message}
                  onChange={(e) => handleInputChange("message", e.target.value)}
                  maxLength={1000}
                  className={`rounded-xl min-h-[120px] bg-background hover:border-primary transition-colors ${errors.message ? "border-destructive" : ""}`}
                />
                {errors.message && <p className="text-destructive text-sm mt-1">{errors.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full py-6 glow-on-hover hover:scale-[1.02] transition-all"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </div>
        </section>

        {/* Questions CTA */}
        <div className="kit-curve-lg bg-card p-12 text-center border border-hairline-warm animate-scale-in">
          <h2 className="text-2xl font-bold mb-4">Have questions?</h2>
          <p className="text-muted-foreground mb-6">Reach out to our team. We're happy to tell you more about the Creator Programme.</p>
          <Button asChild variant="outline" className="rounded-full px-8 py-6 hover:scale-105 transition-all">
            <a href="https://wa.me/2348126988237" className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              WhatsApp Us
            </a>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Creator;
