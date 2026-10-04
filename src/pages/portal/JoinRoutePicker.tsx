import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import { KitMain } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { SectionHead } from "@/components/mc/service-sections";
import { art } from "@/components/mc/art";
import { TRACK_ART } from "@/components/candidate/track-art";
import { JOIN_TRACKS, type JoinTrack } from "@/lib/join-tracks";
import { cn } from "@/lib/utils";

/**
 * Join the network: the third door from the home page, and the first step of
 * the candidate sign-up. It sits inside the normal site (header, footer) like
 * the other two doors, and asks one question: which of these is you?
 *  - desktop: the four routes hang from the hero's bottom edge in one row,
 *    each showing its minutes, typical roles and the documents it asks for;
 *  - phones: the routes are tap doors; the open one shows its documents and
 *    the button, so the list stays short.
 * The copy makes no promises about work, pay or timing.
 */



const STEPS = [
  { title: "Tell us who you are", text: "A few details and a password. Two minutes." },
  { title: "Add your documents once", text: "We hold them, so you never fill the same form twice." },
  { title: "Say when you are free", text: "We only put you forward for work that fits." },
];

const lead = "Nurses, carers, doctors and the people who keep care running. Build one profile, and pick your route below.";

const TILTS = [-1.2, 0.8, -0.6, 1];

/** The documents a route asks for, as small square chips. */
const DocChips = ({ track, onNavy = false }: { track: JoinTrack; onNavy?: boolean }) => (
  <ul className="mt-2 flex flex-wrap gap-1.5">
    {track.documents.map((d) => (
      <li
        key={d.label}
        className={cn(
          "px-2 py-1 text-[12.5px] font-bold",
          d.required
            ? onNavy
              ? "bg-white/15 text-white"
              : "bg-tint text-navy"
            : "border border-navy/20 text-muted-foreground",
        )}
      >
        {d.label}
      </li>
    ))}
  </ul>
);

const JoinRoutePicker = () => {
  const [open, setOpen] = useState<string>(JOIN_TRACKS[0].slug);

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="Join our network | Medic Connect"
        description="Apply to join the Medic Connect network of nurses, caregivers, doctors, and allied health professionals across Nigeria."
        path="/join"
      />
      <MedicHeader />

      {/* Phones and tablets: the professionals peek in beside the copy. */}
      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px] lg:hidden">
        <Watermark glyph="inf" size={520} opacity={0.12} className="-right-[230px] top-[40px]" />
        <div className="relative mx-auto max-w-[720px] px-[22px] pb-10 sm:px-[50px]">
          <div className="max-w-[70%] sm:max-w-[60%]">
            <KitPillHeading text="Work that fits your skills" accent={[3]} align="left" />
          </div>
          <p className="mt-5 max-w-[58%] text-[15px] leading-[1.55] text-body-navy sm:max-w-[50%] sm:text-[18px]">{lead}</p>
          <p className="mt-4 text-[14px] text-body-navy">
            Already joined?{" "}
            <Link to="/portal/login" className="font-extrabold text-white underline underline-offset-4">
              Sign in
            </Link>
          </p>
          <div className="pointer-events-none absolute bottom-0 right-2 flex max-w-[44%] items-end justify-end">
            {[art.proDoctor, art.proPostnatal].map((src, i) => (
              <img key={src} src={src} alt="" className={cn("h-[170px] object-contain sm:h-[220px]", i > 0 && "-ml-8")} />
            ))}
          </div>
        </div>
      </section>

      {/* Desktop: the professionals stand beside the headline blocks, clear of the lead text. */}
      <section className="relative -mt-[114px] hidden overflow-hidden bg-navy pt-[150px] lg:block">
        <Watermark glyph="inf" size={980} opacity={0.12} className="-right-[260px] top-[40px]" />
        <div className="relative mx-auto max-w-[1440px] px-[50px] pb-[260px]">
          <div className="max-w-[520px] xl:max-w-[640px]">
            <p className="eyebrow !text-brand-soft">Join the network</p>
            <div className="mt-4">
              {/* Only one hero shows at a time; the hidden one is display:none, so the page has one visible h1. */}
              <KitPillHeading text="Work that fits your skills" accent={[3]} align="left" />
            </div>
            <p className="mt-6 max-w-[42ch] text-[19px] leading-[1.6] text-body-navy xl:text-[20px]">{lead}</p>
            <p className="mt-4 text-[16px] text-body-navy">
              Already joined?{" "}
              <Link to="/portal/login" className="font-extrabold text-white underline underline-offset-4 hover:text-brand-soft">
                Sign in
              </Link>
            </p>
          </div>
          <div className="pointer-events-none absolute right-[50px] top-[10px] flex items-end xl:right-[110px]">
            {[art.proNurseKit, art.proDoctor, art.proPostnatal, art.proNurseCoat].map((src, i) => (
              // Narrower laptops show three, so the group never runs into the headline.
              <img
                key={src}
                src={src}
                alt=""
                className={cn("h-[250px] object-contain xl:h-[320px]", i > 0 && "-ml-8 xl:-ml-10", i === 0 && "hidden xl:block", i === 1 && "ml-0 xl:-ml-10")}
              />
            ))}
          </div>
        </div>
      </section>

      <KitMain className="relative pt-8 lg:-mt-[170px] lg:pt-0">
        <section aria-labelledby="routes-heading" className="relative">
          <h2 id="routes-heading" className="text-[30px] leading-none tracking-[-0.05em] lg:sr-only">
            Which of these is you?
          </h2>
          <div aria-hidden="true" className="absolute inset-x-0 top-[2px] hidden h-[3px] bg-brand-soft lg:block" />

          {/* Desktop: the four routes in one row, everything visible. */}
          <div className="hidden grid-cols-4 gap-6 lg:grid">
            {JOIN_TRACKS.map((t, i) => (
              <div
                key={t.slug}
                style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg` }}
                className="mc-tilt relative flex flex-col border-2 border-navy bg-white shadow-offset"
              >
                <div className="relative m-2.5 mb-0 mt-6 h-[160px] bg-tint">
                  <img src={TRACK_ART[t.slug]} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[140px] object-contain" />
                </div>
                <NotchTag tone={i % 2 ? "tint" : "blue"} outlined={i % 2 === 1} size="sm" tilt={-3} className="absolute -top-3 left-4">
                  About {t.minutes} min
                </NotchTag>
                <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                  <h3 className="text-[21px] leading-[1.1] tracking-[-0.04em]">{t.label}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.5] text-body">{t.blurb}</p>
                  <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">For example</p>
                  <p className="mt-1 text-[14px] leading-[1.5] text-body">{t.examples}</p>
                  <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">You will need</p>
                  <DocChips track={t} />
                  <div className="mt-auto pt-5">
                    <Link
                      to={`/join/${t.slug}/account`}
                      className="flex min-h-[48px] items-center justify-center rounded-control bg-brand px-5 text-[15px] font-extrabold text-white shadow-offset-sm transition-colors duration-200 hover:bg-navy"
                    >
                      Create my profile <span aria-hidden="true" className="ml-1.5">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Phones: tap doors; the open one shows its documents and the button. */}
          <ul className="mt-6 flex flex-col gap-3 lg:hidden">
            {JOIN_TRACKS.map((t) => {
              const isOpen = open === t.slug;
              return (
                <li key={t.slug} className={cn("border-2 border-navy bg-white", isOpen ? "shadow-offset" : "shadow-offset-sm")}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? "" : t.slug)}
                    className="relative flex w-full items-stretch text-left"
                  >
                    <div className="flex flex-1 flex-col gap-1 py-4 pl-4 pr-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">About {t.minutes} min</span>
                      <b className="text-[19px] font-extrabold leading-[1.1] tracking-[-0.03em] text-navy">{t.label}</b>
                      <span className="text-[14px] leading-[1.45] text-body">{t.blurb}</span>
                    </div>
                    <div className="relative m-1.5 w-[96px] shrink-0 bg-tint">
                      <img src={TRACK_ART[t.slug]} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[92px] object-contain" />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t-2 border-navy/10 px-4 pb-4 pt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">For example</p>
                      <p className="mt-1 text-[14px] leading-[1.5] text-body">{t.examples}</p>
                      <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">You will need</p>
                      <DocChips track={t} />
                      <Link
                        to={`/join/${t.slug}/account`}
                        className="mt-4 flex min-h-[48px] items-center justify-center rounded-control bg-brand text-[16px] font-extrabold text-white shadow-offset-sm active:bg-navy"
                      >
                        Create my profile <span aria-hidden="true" className="ml-1.5">→</span>
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how-heading" className="mt-20 lg:mt-28">
          <SectionHead id="how-heading" eyebrow="How it works" title="One profile. No repeat forms." />
          <ol className="grid gap-6 lg:grid-cols-3 lg:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5">
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center text-[22px] font-black text-white shadow-offset-sm", i === 2 ? "bg-navy" : "bg-brand")}>
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="text-[21px] leading-[1.15] tracking-[-0.035em]">{s.title}</h3>
                  <p className="mt-1.5 text-[16px] leading-[1.6] text-body">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Not sure, and the one other way in. */}
        <section className="mt-20 grid gap-6 lg:mt-28 lg:grid-cols-2">
          <div className="relative flex items-center gap-5 overflow-hidden bg-navy p-6 shadow-offset-blue sm:p-8">
            <img src={art.objChatCall} alt="" className="h-[72px] w-[72px] shrink-0 object-contain" />
            <div>
              <h2 className="text-[22px] leading-[1.15] tracking-[-0.04em] !text-white">Not sure which route fits?</h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-body-navy">
                WhatsApp us on{" "}
                <a href="https://wa.me/2348126988237" className="font-extrabold text-white underline underline-offset-4">
                  +234 812 698 8237
                </a>
                . You can change your route later from your profile.
              </p>
            </div>
          </div>
          <Link to="/creator" className="group relative flex items-center gap-5 border-2 border-navy bg-white p-6 shadow-offset sm:p-8">
            <img src={art.nurseFilmingExplainer} alt="" className="h-[96px] w-[72px] shrink-0 object-contain object-bottom" />
            <div>
              <h2 className="text-[22px] leading-[1.15] tracking-[-0.04em]">Make health content?</h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-body">
                Our Creator programme is for healthcare and wellness creators.{" "}
                <span className="font-extrabold text-brand group-hover:text-navy">
                  See the programme <span aria-hidden="true">→</span>
                </span>
              </p>
            </div>
          </Link>
        </section>
      </KitMain>

      <Footer />
    </div>
  );
};

export default JoinRoutePicker;
