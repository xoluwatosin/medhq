import { SOCIAL_PROFILES } from "@/lib/social-profiles";
import { Link } from "react-router-dom";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import WelcomeIntake from "@/components/WelcomeIntake";
import { Highlight, Watermark } from "@/components/mc/brand";
import Credentials from "@/components/mc/Credentials";
import { art } from "@/components/mc/art";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import { cn } from "@/lib/utils";

/**
 * The home page routes each visitor to one of three doors. Phones and desktops
 * get separately built layouts rather than one layout that reflows:
 *  - desktop shows all three doors at once, hanging from one line (the
 *    "connected" idea), and lets the eye choose;
 *  - phones get one decision at a time: a short hero, then three full-width
 *    doors in thumb reach, with a sticky WhatsApp bar.
 */

type Tone = "blue" | "navy" | "tint";

const doors: {
  title: string;
  description: string;
  cta: string;
  href: string;
  /** One person, or a group (the network) shown overlapping like a team photo. */
  people: string[];
  tone: Tone;
  tilt: number;
}[] = [
  {
    title: "Care at home",
    description: "Professional care and support for you or someone you care about.",
    cta: "Explore care",
    href: "/care-at-home",
    people: [art.familyDoorNurse],
    tone: "blue",
    tilt: -2,
  },
  {
    title: "For facilities",
    description: "Vetted healthcare professionals and support for your organisation.",
    cta: "Explore facility services",
    href: "/for-facilities",
    people: [art.charDoctor],
    tone: "navy",
    tilt: 1.5,
  },
  {
    title: "Join the network",
    description: "Work, opportunities and professional development for healthcare professionals.",
    cta: "Join the network",
    href: "/join",
    people: [art.proNurseKit, art.proDoctor, art.proPostnatal, art.proNurseCoat],
    tone: "tint",
    tilt: -1,
  },
];

const windowTone: Record<Tone, string> = { blue: "bg-brand", navy: "bg-navy", tint: "bg-tint" };

const Home = () => (
  <div className="min-h-dvh bg-background animate-fade-in">
    <SEO
      title="Medic Connect | The Care Operating System for Nigeria"
      description="Care at home, healthcare staffing for facilities, and a verified network of nurses and carers. Medic Connect connects care across Lagos and Nigeria."
      path="/"
      jsonLd={[
        medicalBusinessSchema(),
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Medic Connect",
          url: "https://www.medicconnect.co",
          memberOf: {
            "@type": "Organization",
            name: "Healthcare Federation of Nigeria",
            url: "https://hfnigeria.com",
          },
          sameAs: SOCIAL_PROFILES,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Medic Connect",
          url: "https://www.medicconnect.co",
        },
      ]}
    />
    <MedicHeader />
    <WelcomeIntake />

    {/* Hero. One headline for both layouts; sizes and spacing differ. The
        negative margin runs the navy under the sticky header (80px / 114px). */}
    <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[112px] sm:-mt-[114px] sm:pt-[164px]">
      <Watermark glyph="full" size={620} opacity={0.12} className="-right-[120px] -top-[40px] hidden lg:block" />
      <Watermark glyph="full" size={340} opacity={0.12} className="-bottom-[120px] -right-[110px] lg:hidden" />
      <div className="relative mx-auto max-w-[1440px] px-[22px] pb-10 sm:px-[50px] lg:pb-[196px]">
        <h1 className="text-[52px] leading-[0.96] tracking-[-0.06em] !text-white sm:text-[72px] lg:text-[104px]">
          Health, <Highlight>connected</Highlight>.
        </h1>
        <p className="mt-4 text-[19px] leading-[1.45] text-body-navy sm:text-[22px] lg:mt-6 lg:text-[26px]">
          Care when &amp; where you need it.
        </p>
      </div>
    </section>

    {/* ---------- Desktop doors: three cards hanging from one line ---------- */}
    <section aria-labelledby="help-heading-desktop" className="relative -mt-[180px] hidden lg:block">
      <div className="relative mx-auto max-w-[1440px] px-[50px]">
        <h2 id="help-heading-desktop" className="mb-9 text-[30px] tracking-[-0.04em] !text-white">
          How can we help?
        </h2>
        {/* The line the doors hang from. */}
        <div aria-hidden="true" className="absolute left-[50px] right-[50px] top-[81px] h-[3px] bg-brand-soft" />
        <div className="grid grid-cols-3 gap-10 xl:gap-14">
          {doors.map((d) => (
            <Link
              key={d.href}
              to={d.href}
              style={{ ["--mc-tilt" as string]: `${d.tilt}deg` }}
              className="mc-tilt group relative block origin-top focus-visible:outline-offset-8"
            >
              {/* The clip holding the card to the line. */}
              <span aria-hidden="true" className="absolute -top-[22px] left-1/2 z-10 -ml-[9px] h-[26px] w-[18px] border-[3px] border-b-0 border-white" />
              <div
                className={cn(
                  "flex h-full flex-col border-2 border-navy bg-white transition-shadow duration-200",
                  d.tone === "blue" ? "shadow-offset" : "shadow-offset-blue",
                  "group-hover:shadow-[10px_10px_0_hsl(var(--navy))]",
                )}
              >
                {/* The picture sits in a white print border so it stands off the navy behind. */}
                <div className={cn("relative m-2.5 mb-0 h-[170px] overflow-hidden", windowTone[d.tone])}>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
                    {d.people.map((src, i) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className={cn("h-[158px] object-contain", i > 0 && "-ml-7")}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-6 pb-5 pt-4">
                  <h3 className="text-[28px] leading-[1.05] tracking-[-0.045em]">{d.title}</h3>
                  <p className="text-[16px] leading-[1.6] text-body">{d.description}</p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-3 text-[16px] font-extrabold text-brand transition-colors duration-200 group-hover:text-navy">
                    {d.cta}
                    <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1.5">
                      →
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>

    {/* ---------- Mobile doors: one full-width tap target each ---------- */}
    <section aria-labelledby="help-heading-mobile" className="px-[22px] pt-8 sm:px-[50px] lg:hidden">
      <h2 id="help-heading-mobile" className="text-[30px] leading-none tracking-[-0.05em]">
        How can we help?
      </h2>
      <div className="mt-6 flex flex-col gap-4">
        {doors.map((d) => {
          const dark = d.tone !== "tint";
          return (
            <Link
              key={d.href}
              to={d.href}
              className={cn(
                "relative flex min-h-[148px] overflow-hidden transition-colors duration-150",
                windowTone[d.tone],
                dark ? "active:bg-navy-mid" : "active:bg-tint-deep",
                d.tone === "navy" ? "shadow-offset-blue" : "shadow-offset-sm",
              )}
            >
              <div className="relative z-10 flex w-[64%] flex-col gap-1.5 py-5 pl-5 pr-2">
                <h3 className={cn("text-[24px] leading-[1.05] tracking-[-0.045em]", dark && "!text-white")}>{d.title}</h3>
                <p className={cn("text-[14.5px] leading-[1.5]", dark ? "text-white/90" : "text-body")}>{d.description}</p>
                <span className={cn("mt-auto pt-2 text-[15px] font-extrabold", dark ? "text-white" : "text-brand")}>
                  {d.cta} <span aria-hidden="true">→</span>
                </span>
              </div>
              {/* The people peek in from the right edge; a group shows three on a phone. */}
              <div className="pointer-events-none absolute bottom-0 right-1 flex max-w-[46%] items-end justify-end">
                {d.people.slice(0, 3).map((src, i) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className={cn("object-contain object-bottom", d.people.length > 1 ? "h-[124px]" : "h-[140px]", i > 0 && "-ml-6")}
                  />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>

    {/* ---------- Credentials: stamps on desktop, a 2 by 2 grid on phones ---------- */}
    <section aria-labelledby="trust-heading" className="mx-auto max-w-[1440px] px-[22px] pb-16 pt-14 sm:px-[50px] lg:pb-24 lg:pt-28">
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="eyebrow">Why you can trust us</p>
          <h2 id="trust-heading" className="mt-3 text-[30px] leading-none tracking-[-0.05em] lg:text-[44px]">
            Checked, licensed and accountable.
          </h2>
        </div>
        <Credentials className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:mt-0 lg:grid-cols-4 lg:gap-8" />
      </div>
    </section>

    <Footer />
  </div>
);

export default Home;
