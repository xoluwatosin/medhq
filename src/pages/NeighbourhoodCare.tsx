import { Link } from "react-router-dom";
import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import CareRequestDialog from "@/components/CareRequestDialog";
import { KitMain } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { NotchTag, Watermark } from "@/components/mc/brand";
import Credentials from "@/components/mc/Credentials";
import { SectionHead } from "@/components/mc/service-sections";
import { art } from "@/components/mc/art";
import { getNeighbourhood } from "@/lib/neighbourhoods";
import { faqSchema, medicalServiceSchema } from "@/lib/medical-schema";
import { cn } from "@/lib/utils";

interface NeighbourhoodCareProps {
  slug: string;
}

/**
 * Each area gets its own headline, illustration and watermark, so the pages
 * read as written for that neighbourhood rather than one page with the name
 * swapped. The words, estates, hospitals and questions come from
 * src/lib/neighbourhoods.ts.
 */
const LOOK: Record<string, { headline: string; accent: number; art: string; watermark: "o" | "cross" | "inf"; person: string }> = {
  ikoyi: { headline: "Quiet, expert care in Ikoyi.", accent: 1, art: art.grandfatherWalkingStick, watermark: "o", person: art.bedsideHandholding },
  "banana-island": { headline: "Discreet care on Banana Island.", accent: 0, art: art.caregiverSuitcase, watermark: "inf", person: art.elderWomanAdire },
  parkview: { headline: "Care at home in Parkview.", accent: 2, art: art.elderWomanAdire, watermark: "cross", person: art.grandfatherWalkingStick },
  "osborne-foreshore": { headline: "Care on the Osborne waterfront.", accent: 4, art: art.doctorWelcomedDoor, watermark: "o", person: art.charCaregiver },
  "victoria-island": { headline: "Care that fits a VI day.", accent: 4, art: art.nurseWomanBpCuff, watermark: "cross", person: art.proNurseCoat },
  "eko-atlantic": { headline: "Care in Eko Atlantic City.", accent: 3, art: art.nannyReading, watermark: "inf", person: art.nurseWomanBpCuff },
  lekki: { headline: "Lekki families, looked after.", accent: 2, art: art.postnatalSpecialist, watermark: "o", person: art.carerPlayBaby },
  "lekki-phase-1": { headline: "Care for Lekki Phase 1 homes.", accent: 0, art: art.carerPlayBaby, watermark: "inf", person: art.postnatalSpecialist2 },
  vgc: { headline: "Care inside VGC's gates.", accent: 3, art: art.schoolRun, watermark: "cross", person: art.charGrandma },
  ajah: { headline: "Care along the Lekki-Epe corridor.", accent: 0, art: art.carerTableChild, watermark: "o", person: art.charNurse },
  ikeja: { headline: "Mainland care, close to home.", accent: 1, art: art.elderWalkingFrame, watermark: "inf", person: art.nurseManKit },
  "ikeja-gra": { headline: "Care in the heart of GRA.", accent: 4, art: art.grandparentsVideoCall, watermark: "cross", person: art.elderWalkingFrame },
  "magodo-gra": { headline: "Care across Magodo GRA.", accent: 2, art: art.motherNewbornSuitcase, watermark: "o", person: art.grandfatherWalkingStick },
  surulere: { headline: "Care for Surulere's families.", accent: 0, art: art.charGrandma, watermark: "inf", person: art.charCaregiver },
  yaba: { headline: "Care near LUTH and Yaba.", accent: 0, art: art.nurseManKit, watermark: "cross", person: art.charDoctor },
};

/** The service page each common need links to, by keyword in its title. */
const NEED_LINKS: [RegExp, string][] = [
  [/postnatal|omugwo/i, "/postnatal-care"],
  [/nann|child(?!ren's)|school/i, "/nanny-childcare"],
  [/children's|paediatric|pediatric/i, "/pediatric-care"],
  [/surg|discharge|hospital stay|recovery/i, "/post-surgical-care"],
  [/elder|parent|older|ageing/i, "/eldercare"],
  [/abroad|diaspora/i, "/care-from-abroad"],
  [/dementia|stroke|chronic|nursing/i, "/clinical-home-care"],
];
const linkFor = (title: string) => NEED_LINKS.find(([re]) => re.test(title))?.[1] ?? "/care-at-home";

const NEED_TILTS = [-1, 0.8, -0.6, 1];

const NeighbourhoodCare = ({ slug }: NeighbourhoodCareProps) => {
  const n = getNeighbourhood(slug);
  if (!n) return null;
  const look = LOOK[n.slug] ?? LOOK.ikoyi;

  const path = `/home-care-${n.slug}`;
  // Keep title ≤ 60 chars and description ≤ 160 chars across all neighbourhoods to avoid SERP truncation.
  const title = `Home Care in ${n.name} | Nurses 24/7`;
  const description = `Registered nurses and vetted caregivers in ${n.name}, Lagos. Post-surgical, elder, postnatal and paediatric care at home. HEFAMAA accredited.`;
  const nearby = (n.nearby ?? []).map(getNeighbourhood).filter((x): x is NonNullable<typeof x> => !!x);

  const buttons = (
    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
      <CareRequestDialog
        source={`neighbourhood:${n.slug}`}
        trigger={
          <button className="inline-flex min-h-[48px] items-center justify-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy shadow-offset-blue transition-colors hover:bg-tint">
            Request care
          </button>
        }
      />
      <a
        href={`https://wa.me/2348126988237?text=${encodeURIComponent(`Hi Medic Connect, I'd like to arrange care in ${n.name}.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[48px] items-center justify-center rounded-control border-2 border-white/40 px-6 text-[16px] font-extrabold text-white transition-colors hover:bg-white/10"
      >
        Chat on WhatsApp
      </a>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title={title}
        description={description}
        path={path}
        jsonLd={[
          medicalServiceSchema({
            name: `Home Care in ${n.name}, Lagos`,
            path,
            description: `Skilled in-home nursing and caregiver services for families in ${n.name}, Lagos. Post-surgical recovery, eldercare, postnatal and paediatric care delivered at home by HEFAMAA-accredited Medic Connect.`,
            specialty: "Nursing",
            audienceType: `Families and patients in ${n.name}, Lagos`,
            includeDiaspora: true,
            relatedProcedures: [
              "Skilled nursing visits",
              "24-hour and live-in nursing",
              "Wound care and dressing changes",
              "Post-surgical recovery support",
              "Eldercare and companion care",
              "Postnatal and Omugwo care",
              "Paediatric home nursing",
            ],
            offers: {
              lowPrice: 5000,
              highPrice: 380000,
              offerCount: 9,
              description:
                "Nursing visits from ₦12,000. 24-hour nursing from ₦55,000 per day. Live-in caregivers from ₦12,000 per day. Initial home assessment ₦35,000.",
            },
          }),
          faqSchema(n.faqs),
        ]}
      />

      <MedicHeader />

      {/* One hero for both sizes; the person stands on the band's bottom edge beside the copy. */}
      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
        <Watermark glyph={look.watermark} size={560} opacity={0.12} className="-right-[200px] -top-[120px]" />
        <div className="relative mx-auto max-w-[1440px] px-[22px] pb-12 sm:px-[50px] lg:pb-16">
          <div className="max-w-[64%] lg:max-w-[760px]">
            <p className="eyebrow !text-brand-soft">
              Home care in {n.name} · {n.axis === "Island" ? "Lagos Island" : "Lagos Mainland"}
            </p>
            <div className="mt-3 lg:mt-4">
              <KitPillHeading text={look.headline} accent={[look.accent]} align="left" />
            </div>
            <p className="mt-5 text-[15px] leading-[1.55] text-body-navy sm:text-[18px] lg:max-w-[52ch] lg:text-[19px]">{n.intro}</p>
            <div className="max-w-[340px] lg:max-w-none">{buttons}</div>
            <p className="mt-5 text-[14px] font-bold text-white/80 sm:text-[15px]">{n.responseLine}</p>
          </div>
          <img
            src={look.art}
            alt=""
            className="pointer-events-none absolute bottom-0 right-3 h-[230px] max-w-[36%] object-contain object-right-bottom sm:right-[40px] sm:h-[300px] lg:right-[100px] lg:h-[380px] lg:max-w-none"
          />
        </div>
      </section>

      <KitMain>
        {/* Streets and estates: what makes this page about this place. */}
        <section aria-labelledby="areas-heading">
          <SectionHead id="areas-heading" eyebrow={`Where we work in ${n.name}`} title="Streets and estates we cover" />
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
            <ul className="flex flex-wrap gap-3">
              {n.landmarks.map((l, i) => (
                <li
                  key={l}
                  className={cn(
                    "border-2 border-navy px-4 py-2.5 text-[15.5px] font-extrabold text-navy",
                    i % 3 === 0 ? "bg-tint" : "bg-white",
                    i % 2 ? "rotate-[0.8deg]" : "-rotate-[0.8deg]",
                  )}
                >
                  {l}
                </li>
              ))}
            </ul>
            <div className="mx-auto hidden h-[200px] w-[220px] place-items-center bg-tint lg:grid">
              <img src={art.objMapPinHome} alt="" loading="lazy" className="h-[150px] object-contain" />
            </div>
          </div>
        </section>

        {/* How families here use us, each linking to the full service page. */}
        <section aria-labelledby="needs-heading" className="mt-20 lg:mt-28">
          <SectionHead id="needs-heading" eyebrow="What families here ask for" title={`How ${n.name} families use us`} />
          <ul className={cn("grid gap-5 sm:grid-cols-2 lg:gap-6", n.commonNeeds.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
            {n.commonNeeds.map((need, i) => (
              <li key={need.title}>
                <Link
                  to={linkFor(need.title)}
                  style={{ ["--mc-tilt" as string]: `${NEED_TILTS[i % NEED_TILTS.length]}deg` }}
                  className={cn(
                    "mc-tilt group flex h-full flex-col gap-2 border-2 border-navy bg-white p-5",
                    i % 2 ? "shadow-offset-blue" : "shadow-offset",
                  )}
                >
                  <h3 className="text-[19px] leading-[1.15] tracking-[-0.03em]">{need.title}</h3>
                  <p className="text-[15px] leading-[1.55] text-body">{need.description}</p>
                  <span className="mt-auto pt-2 text-[15px] font-extrabold text-brand group-hover:text-navy">
                    Find out more <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Hospital to home. */}
        <section aria-labelledby="hospitals-heading" className="mt-20 grid items-start gap-10 lg:mt-28 lg:grid-cols-2 lg:gap-16">
          <div>
            <hr className="mb-6 border-t-4 border-navy" />
            <p className="eyebrow">Hospital to home</p>
            <h2 id="hospitals-heading" className="mt-3 text-[30px] leading-none tracking-[-0.05em] sm:text-[44px]">
              Home from hospital, without the scramble.
            </h2>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.65] text-body">
              With your consent, we collect the discharge notes, medicines list and follow-up dates, so the first day at home
              isn't the day everything gets figured out.
            </p>
          </div>
          <div className="relative border-2 border-navy bg-white p-6 shadow-offset sm:p-7">
            <NotchTag tone="blue" size="sm" className="absolute -top-3 left-6">
              Hospitals near {n.name}
            </NotchTag>
            <ul className="divide-y-2 divide-navy/10">
              {n.nearbyHospitals.map((h) => (
                <li key={h} className="flex items-center gap-4 py-3.5 first:pt-2 last:pb-0">
                  <img src={art.objClinic} alt="" loading="lazy" className="h-10 w-10 shrink-0 object-contain" />
                  <span className="text-[16px] font-bold leading-[1.35] text-navy">{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Local questions. */}
        <section aria-labelledby="faq-heading" className="mt-20 lg:mt-28">
          <SectionHead id="faq-heading" eyebrow="Questions" title={`Common questions from ${n.name}`} />
          <ul className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            {n.faqs.map((f) => (
              <li key={f.q} className="flex flex-col gap-2 bg-tint px-6 py-6 sm:px-7">
                <span className="text-[19px] font-medium leading-[1.3] tracking-[-0.02em] text-muted-foreground">&#8220;{f.q}&#8221;</span>
                <span className="text-[17px] font-bold leading-[1.5] text-navy">{f.a}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="trust-heading" className="mt-20 lg:mt-28">
          <SectionHead id="trust-heading" eyebrow="Why families trust us" title="Checked, licensed and accountable." />
          <Credentials />
        </section>

        {nearby.length > 0 && (
          <section aria-labelledby="nearby-heading" className="mt-20 lg:mt-28">
            <SectionHead id="nearby-heading" eyebrow="Nearby" title="We also cover" />
            <ul className="flex flex-wrap gap-3">
              {nearby.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/home-care-${a.slug}`}
                    className="inline-flex min-h-[48px] items-center gap-2 border-2 border-navy bg-white px-5 text-[16px] font-extrabold text-navy shadow-offset-sm transition-colors hover:bg-tint"
                  >
                    {a.name} <span aria-hidden="true" className="text-brand">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <CTASection
          headline={`Need a nurse or caregiver in ${n.name}?`}
          body="Tell us what is needed and we will arrange the home assessment and the right professional."
          person={look.person}
        />
      </KitMain>

      <Footer />
    </div>
  );
};

export default NeighbourhoodCare;
