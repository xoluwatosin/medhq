import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import AudienceHero from "@/components/home/AudienceHero";
import CTASection from "@/components/CTASection";
import WelcomeIntake from "@/components/WelcomeIntake";
import CareRequestDialog from "@/components/CareRequestDialog";
import { kitHeroPrimaryButton, kitHeroSecondaryButton } from "@/components/kit/KitLayout";
import {
  ChevronSteps,
  ClipArt,
  EmergencyBox,
  Fragment,
  Highlight,
  NotchTag,
  PriceTag,
  SpeechBubble,
  Stamp,
  TapeLabel,
  TickerStrip,
  Ticket,
  TiltCard,
} from "@/components/mc/brand";
import { art } from "@/components/mc/art";

const doors = [
  {
    n: "01",
    eyebrow: "Families",
    title: "Care at home",
    description:
      "Nurses, nannies, eldercare and maternity support placed in your home across Lagos, usually within 48 hours.",
    href: "/care-at-home",
    cta: "Find care",
    art: art.objHouseHeart,
    tone: "blue" as const,
    tilt: -2,
  },
  {
    n: "02",
    eyebrow: "Facilities",
    title: "For facilities",
    description:
      "Clinical and support staff for hospitals, clinics and research sites, compliance cleared before they reach your ward.",
    href: "/for-facilities",
    cta: "Request staff",
    art: art.objClipboard,
    tone: "tint" as const,
    tilt: 1.5,
  },
  {
    n: "03",
    eyebrow: "Professionals",
    title: "Join the network",
    description:
      "Nurses, carers, doctors and allied health professionals. Get verified once and be matched to work that fits you.",
    href: "/join",
    cta: "Apply",
    art: art.objCarePlan,
    tone: "white" as const,
    tilt: -1,
  },
];

const report = [
  { time: "06:40", tone: "blue" as const, tilt: -1.5, note: "Slept through. Ate a full breakfast." },
  { time: "12:15", tone: "tint" as const, tilt: 1, note: "Blood pressure checked. Walk to the gate and back." },
  { time: "18:30", tone: "navy" as const, tilt: -1, note: "Asked for the radio. Good day all round." },
];

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
          sameAs: ["https://flyingdoctorsnigeria.com"],
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

    <AudienceHero variant="split">
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16">
        <div className="relative flex flex-col gap-6">
          <p className="eyebrow !text-muted-navy">For families, near or far</p>
          <h1 className="text-[48px] leading-[0.96] tracking-[-0.06em] !text-white sm:text-[72px] xl:text-[96px]">
            The <Highlight>care</Highlight> operating system.
          </h1>
          <p className="max-w-[40ch] text-[18px] leading-[1.55] text-body-navy sm:text-[21px]">
            A vetted caregiver at home, and a short report from them every day. Three ways in. Choose the one that fits you.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="https://wa.me/2348126988237" target="_blank" rel="noopener noreferrer" className={kitHeroPrimaryButton}>
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Chat on WhatsApp
            </a>
            <a href="tel:+2348126988237" className={kitHeroSecondaryButton}>
              Call +234 812 698 8237
            </a>
          </div>
          <p className="text-[14px] text-body-navy">HEFAMAA accredited. Insured. Every professional vetted.</p>
        </div>

        {/* A visit note, the way families see their day. Grandma stands on its corner. */}
        <div className="relative mr-10 sm:mr-14 lg:mr-10">
          <Stamp title="HEFAMAA" sub="ACCREDITED" onNavy tilt={8} className="absolute -left-3 -top-12 z-10 bg-navy sm:-left-8" />
          <div className="relative flex flex-col gap-5 bg-white px-6 pb-8 pt-7 shadow-offset-blue sm:px-8">
            <div className="flex justify-between text-[12px] font-extrabold tracking-[0.16em] text-muted-foreground">
              <span>DAILY REPORT</span>
              <span className="text-brand">TUESDAY</span>
            </div>
            {report.map((r) => (
              <div key={r.time} className="flex max-w-[280px] flex-col gap-2">
                <TapeLabel tone={r.tone} tilt={r.tilt}>
                  {r.time}
                </TapeLabel>
                <span className="text-[17px] leading-[1.45] text-ink sm:text-[18px]">{r.note}</span>
              </div>
            ))}
          </div>
          <img
            src={art.charGrandma}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-9 -right-10 h-[190px] sm:-right-12 sm:h-[230px] lg:-right-8"
          />
        </div>
      </div>
    </AudienceHero>

    <TickerStrip
      tone="blue"
      items={["Nurses", "Caregivers", "Nannies", "Postnatal specialists", "Eldercare", "Facility staffing"]}
    />

    <main className="mx-auto max-w-[1440px] px-[22px] py-16 sm:px-[50px] sm:py-24">
      {/* Three doors */}
      <section aria-labelledby="where-to-start" className="grid gap-12 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-5">
          <p className="eyebrow">Where to start</p>
          <h2 id="where-to-start" className="text-[40px] leading-none tracking-[-0.05em] sm:text-[56px]">
            Three ways <Highlight>in</Highlight>.
          </h2>
          <p className="text-[16px] leading-[1.65] text-body">
            Every care plan starts with a <PriceTag amount="₦35,000" className="text-[14px]" /> home care needs assessment.
          </p>
          <ClipArt src={art.objPhoneChat} size={150} className="mt-2 hidden lg:block" />
        </div>

        <div className="grid gap-8 pt-2 sm:grid-cols-3 sm:gap-6">
          {doors.map((d) => (
            <Link key={d.href} to={d.href} className="group block focus-visible:outline-offset-8">
              <TiltCard tone={d.tone} tilt={d.tilt} tape={d.tone === "white"} className="h-full gap-3 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`text-[44px] font-black leading-[0.85] tracking-[-0.06em] ${
                      d.tone === "blue" ? "text-white/45" : "text-brand"
                    }`}
                  >
                    {d.n}
                  </span>
                  <NotchTag tone={d.tone === "blue" ? "white" : "blue"} size="sm">
                    {d.eyebrow}
                  </NotchTag>
                </div>
                <img src={d.art} alt="" className="mx-auto my-1 h-[120px] w-full object-contain" />
                <h3 className={`text-[24px] leading-[1.05] ${d.tone === "blue" ? "!text-white" : ""}`}>{d.title}</h3>
                <p className={`text-[15px] leading-[1.6] ${d.tone === "blue" ? "text-white/90" : "text-body"}`}>{d.description}</p>
                <span
                  className={`mt-auto pt-2 text-[15px] font-extrabold ${
                    d.tone === "blue" ? "text-white" : "text-brand group-hover:text-navy"
                  } transition-colors duration-200`}
                >
                  {d.cta} →
                </span>
              </TiltCard>
            </Link>
          ))}
        </div>
      </section>

      {/* The assessment, as an admission ticket */}
      <section aria-label="The home care needs assessment" className="mt-24 sm:mt-28">
        <Ticket
          label="ADMIT ONE NURSE"
          title="Every care plan starts with an assessment at home."
          stubLabel="FIXED FEE"
          stub={<PriceTag amount="₦35,000" variant="tag" />}
        >
          <div className="flex flex-col gap-5">
            <div className="max-w-[520px]">
              <ChevronSteps steps={["Assessment", "Care plan", "Care starts"]} current={0} />
            </div>
            <p className="max-w-[52ch] text-[15.5px] leading-[1.65] text-body-navy">
              A nurse visits, meets the person and writes the plan with you. A care adviser calls you first, usually the same
              working day.
            </p>
            <CareRequestDialog
              source="home_ticket"
              trigger={<button className={`${kitHeroPrimaryButton} self-start`}>Book the assessment</button>}
            />
          </div>
        </Ticket>
      </section>

      {/* Questions, as a chat thread */}
      <section aria-labelledby="questions" className="mt-24 grid items-start gap-12 sm:mt-28 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <p className="eyebrow">Questions families ask</p>
          <h2 id="questions" className="text-[36px] leading-none tracking-[-0.05em] sm:text-[44px]">
            Ask us anything.
          </h2>
          <div className="flex flex-col gap-3">
            <SpeechBubble>Do I have to be in Lagos?</SpeechBubble>
            <SpeechBubble side="right" tone="tint">
              No. Many families book from abroad and join the assessment on a call.
            </SpeechBubble>
            <SpeechBubble>How soon can care start?</SpeechBubble>
            <SpeechBubble side="right" tone="tint">
              Usually within 48 hours.
            </SpeechBubble>
            <SpeechBubble>Who comes to the house?</SpeechBubble>
            <SpeechBubble side="right" tone="tint">
              A vetted professional matched to the plan. Every one is checked before they reach you.
            </SpeechBubble>
          </div>
        </div>
        <div className="relative flex flex-col gap-8 lg:pt-16">
          <Fragment fragment="Mum is in Surulere and I am in London." answer="Someone you can trust at her door, and word from them every day." />
          <img
            src={art.diasporaSon}
            alt=""
            aria-hidden="true"
            className="pointer-events-none mx-auto h-[220px] object-contain sm:h-[260px]"
          />
          <EmergencyBox />
        </div>
      </section>

      <CTASection
        headline="Not sure which door is yours?"
        body="Tell us what you need and we will point you to the right team."
      />
    </main>

    <Footer />
  </div>
);

export default Home;
