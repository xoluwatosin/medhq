import { Link } from "react-router-dom";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import CTASection from "@/components/CTASection";
import FacilityEnquiryForm from "@/components/facilities/FacilityEnquiryForm";
import { KitMain } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { NotchTag, Watermark } from "@/components/mc/brand";
import Credentials from "@/components/mc/Credentials";
import { SectionHead } from "@/components/mc/service-sections";
import { art } from "@/components/mc/art";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import { cn } from "@/lib/utils";

/**
 * For facilities: the hospital or clinic manager is the visitor, the way the
 * family is on care at home. Built twice, like the other door pages:
 *  - desktop: the four service lines hang across the hero's bottom edge in one
 *    row, then the roles lineup, how it works beside the form, and credentials;
 *  - phones: a short hero with the manager beside the copy, 2 by 2 tiles, a
 *    sideways-scrolling roles lineup, then the steps and the form.
 * No prices: facility work is quoted per scope.
 */

const services = [
  {
    tag: "Staffing",
    title: "Hospital and corporate staffing",
    line: "Doctors, nurses and allied health professionals for shifts, locum cover and permanent roles.",
    href: "/hospital-staffing",
    art: art.locumDoctorBag,
  },
  {
    tag: "Support",
    title: "Hospital support services",
    line: "Housekeeping, laundry, waste, pest control and security, so clinical teams stay on clinical work.",
    href: "/hospital-support",
    art: art.wasteWorkerClinicalBin,
  },
  {
    tag: "Research",
    title: "Clinical research and support",
    line: "GCP trained coordinators, data managers and support staff for trials and studies.",
    href: "/clinical-research",
    art: art.researchCoordinatorTablet,
  },
  {
    tag: "International",
    title: "Medic Connect Global",
    line: "Staffing and support beyond Nigeria, through our international operations.",
    href: "https://www.medicconnect.org",
    art: art.objClinic,
  },
];

/** The roles a facility can book, each standing on one floor line. */
const roles = [
  { label: "Nurses", art: art.charNurse },
  { label: "Doctors", art: art.charDoctor },
  { label: "Pharmacists", art: art.pharmacistMedicineCarton },
  { label: "Lab scientists", art: art.scientistSampleRack },
  { label: "Security", art: art.securityOfficerRadio },
  { label: "Housekeeping", art: art.housekeeperMopBucket },
  { label: "Laundry", art: art.laundryAttendantLinens },
  { label: "Porters", art: art.porterWheelchair },
  { label: "Pest control", art: art.pestControlTechnician },
];

const steps = [
  { title: "Send the rota gap", text: "Roles, dates, shifts and the compliance your site needs." },
  { title: "We match vetted staff", text: "Identity, registration, qualifications and references checked before anyone is put forward." },
  { title: "Cover starts", text: "You confirm the match and the professional reports for the shift." },
];

const lead = "Nurses, doctors, allied health and support staff, checked and compliance cleared before they reach your ward.";

/** Internal paths use the router; Medic Connect Global is a separate site. */
const ServiceLink = ({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) =>
  href.startsWith("http") ? (
    <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link to={href} className={className} style={style}>
      {children}
    </Link>
  );

const TILTS = [-1.2, 0.8, -0.6, 1];

const ForFacilities = () => {
  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Healthcare Staffing for Hospitals and Facilities in Lagos"
        description="Vetted nurses, doctors, allied health and support staff for hospitals, clinics and research sites across Lagos and Nigeria. Compliance checked before deployment."
        path="/for-facilities"
        jsonLd={[medicalBusinessSchema()]}
      />
      <MedicHeader />

      {/* Phones and tablets: headline left, the manager beside the paragraph,
          the first row of tiles rising over the band's bottom edge. */}
      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px] lg:hidden">
        <Watermark glyph="o" size={360} opacity={0.12} className="-right-[150px] -top-[90px]" />
        <div className="relative mx-auto max-w-[720px] px-[22px] pb-[86px] sm:px-[50px]">
          <div className="max-w-[64%] sm:max-w-[60%]">
            <KitPillHeading text="Cover for every shift" accent={[3]} align="left" />
          </div>
          <p className="mt-5 max-w-[56%] text-[15px] leading-[1.55] text-body-navy sm:max-w-[48%] sm:text-[18px]">{lead}</p>
          <img
            src={art.hospitalManagerClipboard}
            alt=""
            className="pointer-events-none absolute bottom-[70px] right-1 h-[210px] max-w-[42%] object-contain object-right-bottom sm:right-[50px] sm:h-[260px]"
          />
        </div>
      </section>

      {/* Desktop: the manager stands on the line the service cards hang from, across the band's bottom edge. */}
      <section className="relative -mt-[114px] hidden overflow-hidden bg-navy pt-[150px] lg:block">
        <Watermark glyph="o" size={620} opacity={0.12} className="-left-[260px] -top-[200px]" />
        <div className="relative mx-auto max-w-[1440px] px-[50px] pb-[240px]">
          <div className="max-w-[780px]">
            <p className="eyebrow !text-brand-soft">For facilities</p>
            <div className="mt-4">
              {/* Only one hero shows at a time; the hidden one is display:none, so the page has one visible h1. */}
              <KitPillHeading text="Cover for every shift" accent={[3]} align="left" />
            </div>
            <p className="mt-6 max-w-[48ch] text-[20px] leading-[1.6] text-body-navy">{lead}</p>
          </div>
          <img
            src={art.hospitalManagerClipboard}
            alt=""
            className="pointer-events-none absolute bottom-[86px] right-[110px] h-[340px] object-contain xl:right-[190px]"
          />
        </div>
      </section>

      <KitMain className="relative -mt-[64px] pt-0 lg:-mt-[170px]">
        <section aria-labelledby="services-heading" className="relative">
          <h2 id="services-heading" className="sr-only">
            Facility services
          </h2>
          {/* The line the cards hang from. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-[2px] hidden h-[3px] bg-brand-soft lg:block" />

          {/* Desktop: four cards in one row. Tags alternate blue and tint, both of which read against the navy hero. */}
          <div className="hidden grid-cols-4 gap-7 lg:grid">
            {services.map((s, i) => (
              <ServiceLink
                key={s.href}
                href={s.href}
                style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg` }}
                className="mc-tilt group relative flex flex-col border-2 border-navy bg-white shadow-offset"
              >
                <div className="relative m-2.5 mb-0 mt-6 h-[170px] bg-tint">
                  <img src={s.art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[150px] object-contain" />
                </div>
                <NotchTag tone={i % 2 ? "tint" : "blue"} outlined={i % 2 === 1} size="sm" tilt={-3} className="absolute -top-3 left-4">
                  {s.tag}
                </NotchTag>
                <div className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
                  <h3 className="text-[21px] leading-[1.1] tracking-[-0.04em]">{s.title}</h3>
                  <p className="text-[15px] leading-[1.55] text-body">{s.line}</p>
                  <span className="mt-auto pt-2 text-[15px] font-extrabold text-brand transition-colors duration-200 group-hover:text-navy">
                    Find out more <span aria-hidden="true">→</span>
                  </span>
                </div>
              </ServiceLink>
            ))}
          </div>

          {/* Phones: 2 by 2 tiles. */}
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            {services.map((s) => (
              <ServiceLink
                key={s.href}
                href={s.href}
                className="flex flex-col border-2 border-navy bg-white shadow-offset-sm transition-colors duration-150 active:bg-tint"
              >
                <div className="relative m-1.5 mb-0 h-[96px] bg-tint">
                  <img src={s.art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[88px] object-contain" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-brand">{s.tag}</span>
                  <b className="text-[15px] font-extrabold leading-[1.15] text-navy">{s.title}</b>
                </div>
              </ServiceLink>
            ))}
          </div>
        </section>

        {/* Who we place: everyone stands on one floor line. */}
        <section aria-labelledby="roles-heading" className="mt-20 lg:mt-28">
          <SectionHead id="roles-heading" eyebrow="Who we place" title="One call, every role on your rota." />
          <div className="-mx-[22px] overflow-x-auto px-[22px] pb-2 sm:-mx-[50px] sm:px-[50px] lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="relative flex w-max snap-x gap-1 lg:grid lg:w-full lg:grid-cols-9 lg:gap-0">
              {roles.map((r) => (
                <li key={r.label} className="flex w-[104px] snap-start flex-col items-center lg:w-auto">
                  <div className="flex h-[150px] items-end lg:h-[190px]">
                    <img src={r.art} alt="" loading="lazy" className="max-h-full max-w-[112px] object-contain object-bottom lg:max-w-[140px]" />
                  </div>
                  <div aria-hidden="true" className="h-[4px] w-full bg-navy" />
                  <span className="mt-3 text-center text-[13px] font-extrabold leading-tight text-navy lg:text-[14px]">{r.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works, beside the call-back form. */}
        <section aria-labelledby="how-heading" className="mt-20 lg:mt-28">
          <SectionHead id="how-heading" eyebrow="How it works" title="Tell us the gap. We fill it." />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_540px] lg:gap-16">
            <ol className="flex flex-col gap-5">
              {steps.map((st, i) => (
                <li key={st.title} className="flex gap-5">
                  <span
                    className={cn(
                      "grid h-12 w-12 shrink-0 place-items-center text-[22px] font-black text-white shadow-offset-sm",
                      i === 2 ? "bg-navy" : "bg-brand",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-[21px] leading-[1.15] tracking-[-0.035em]">{st.title}</h3>
                    <p className="mt-1.5 max-w-[48ch] text-[16px] leading-[1.6] text-body">{st.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <FacilityEnquiryForm />
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="mt-20 lg:mt-28">
          <SectionHead id="trust-heading" eyebrow="Why facilities trust us" title="Checked, licensed and accountable." />
          <Credentials />
        </section>

        <CTASection
          headline="Need cover this week?"
          body="Send us the rota gap and we will tell you what we can fill and when."
          person={art.doctorNurseHandshake}
          hideRequestCare
        />
      </KitMain>

      <Footer />
    </div>
  );
};

export default ForFacilities;
