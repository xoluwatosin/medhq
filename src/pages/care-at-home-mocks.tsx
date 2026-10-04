// TEMPORARY: service-list treatments for /care-at-home, switched with ?cards=a|b|c|mix.
// Delete this file once a direction is chosen.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NotchTag, Tape } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { cn } from "@/lib/utils";

type Service = { title: string; line: string; href: string; price: string; from?: boolean; unit?: string; art: string };
type Group = { name: string; art: string; services: Service[] };

const S = {
  clinical: { title: "Clinical home care", line: "Skilled nursing and medical support at home.", href: "/clinical-home-care", price: "₦20,000", from: true, unit: "per visit", art: art.proNurseKit },
  surgical: { title: "Post-surgical care", line: "Wounds, drains, medication and mobility after surgery.", href: "/post-surgical-care", price: "₦25,000", from: true, unit: "per visit", art: art.objWalkingFrame },
  antenatal: { title: "Antenatal care", line: "Pregnancy checks and support at home.", href: "/antenatal-care", price: "₦30,000", unit: "per visit", art: art.midwifePregnantBp },
  postnatal: { title: "Postnatal care and Omugwo", line: "Rest, recover and bond with your baby.", href: "/postnatal-care", price: "₦30,000", unit: "per visit", art: art.proPostnatal },
  nanny: { title: "Nanny and childcare", line: "Trusted nannies matched to your family.", href: "/nanny-childcare", price: "", art: art.nannyReading },
  pediatric: { title: "Pediatric and special needs", line: "Support for children with medical or developmental needs.", href: "/pediatric-care", price: "", art: art.charBoy },
  elder: { title: "Eldercare", line: "Dignified care that keeps older relatives independent.", href: "/eldercare", price: "₦18,000", unit: "per 4 hours", art: art.charGrandma },
  caregivers: { title: "Caregivers", line: "Personal care, company and appointment escort.", href: "/caregiver", price: "₦18,000", unit: "per 4 hours", art: art.charCaregiver },
  abroad: { title: "Care from abroad", line: "One contact in Nigeria for families overseas.", href: "/care-from-abroad", price: "", art: art.diasporaSon },
} satisfies Record<string, Service>;

const GROUPS: Group[] = [
  { name: "Nursing and recovery", art: art.proNurseKit, services: [S.clinical, S.surgical] },
  { name: "Mums and children", art: art.proPostnatal, services: [S.antenatal, S.postnatal, S.nanny, S.pediatric] },
  { name: "Older relatives and everyday care", art: art.charGrandma, services: [S.elder, S.caregivers, S.abroad] },
];
const ALL = GROUPS.flatMap((g) => g.services);

const PriceText = ({ s, small = false }: { s: Service; small?: boolean }) =>
  s.price ? (
    <span className="whitespace-nowrap tabular-nums">
      {s.from && <span className="mr-1 text-[0.6em] font-bold text-ink">from</span>}
      <b className={cn("font-extrabold tracking-[-0.03em] text-price", small ? "text-[20px]" : "text-[24px]")}>{s.price}</b>
      {s.unit && <span className="ml-1 text-[12px] font-semibold text-muted-foreground">{s.unit}</span>}
    </span>
  ) : (
    <span className="text-[13px] font-bold text-muted-foreground">Quoted after assessment</span>
  );

/** A. Price-tag cards: everything visible, the price on a luggage tag. */
export const CardsA = () => (
  <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
    {ALL.map((s, i) => (
      <Link
        key={s.href}
        to={s.href}
        style={{ ["--mc-tilt" as string]: `${[-1.2, 0.8, -0.6][i % 3]}deg` }}
        className="mc-tilt group relative flex flex-col border-2 border-navy bg-white shadow-offset"
      >
        <div className="relative m-2.5 mb-0 h-[150px] bg-tint">
          <img src={s.art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[138px] object-contain" />
        </div>
        <span
          className={cn(
            "mc-tag-left absolute -right-3 top-6 rotate-[5deg] py-2 pl-6 pr-4 shadow-offset-sm",
            s.price ? "bg-white" : "bg-tint",
          )}
        >
          <PriceText s={s} small />
        </span>
        <div className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
          <h3 className="text-[22px] leading-[1.1] tracking-[-0.04em]">{s.title}</h3>
          <p className="text-[15px] leading-[1.55] text-body">{s.line}</p>
          <span className="mt-auto pt-2 text-[15px] font-extrabold text-brand group-hover:text-navy">
            See {s.title.toLowerCase()} <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    ))}
  </div>
);

const Row = ({ s }: { s: Service }) => (
  <Link to={s.href} className="group flex items-center gap-4 border-t border-hairline py-4 first:border-t-0">
    <span className="grid h-16 w-16 shrink-0 place-items-end overflow-hidden bg-tint">
      <img src={s.art} alt="" loading="lazy" className="mx-auto h-[58px] object-contain" />
    </span>
    <span className="min-w-0 flex-1">
      <b className="block text-[17px] font-extrabold leading-[1.2] text-navy group-hover:text-brand">{s.title}</b>
      <span className="mt-0.5 block text-[14px] leading-[1.45] text-body">{s.line}</span>
      <span className="mt-1 block sm:hidden"><PriceText s={s} small /></span>
    </span>
    <span className="hidden text-right sm:block"><PriceText s={s} /></span>
    <span aria-hidden="true" className="text-[18px] font-extrabold text-brand">→</span>
  </Link>
);

/** B. Three folder tabs on desktop, opening sections on a phone. */
export const CardsB = () => {
  const [tab, setTab] = useState(0);
  return (
    <>
      <div className="hidden lg:block">
        <div role="tablist" className="flex gap-1.5">
          {GROUPS.map((g, i) => (
            <button
              key={g.name}
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={cn(
                "border-2 border-b-0 border-navy px-6 py-3 text-[16px] font-extrabold transition-colors duration-200",
                tab === i ? "bg-navy text-white" : "bg-tint text-navy hover:bg-tint-deep",
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="grid grid-cols-[220px_minmax(0,1fr)] gap-10 border-2 border-navy bg-white p-8 shadow-offset-tint">
          <div className="flex items-end justify-center bg-tint">
            <img src={GROUPS[tab].art} alt="" className="h-[220px] object-contain" />
          </div>
          <div>{GROUPS[tab].services.map((s) => <Row key={s.href} s={s} />)}</div>
        </div>
      </div>
      <Accordion type="single" collapsible defaultValue={GROUPS[0].name} className="flex flex-col gap-3 lg:hidden">
        {GROUPS.map((g) => (
          <AccordionItem key={g.name} value={g.name} className="border-2 border-navy bg-white shadow-offset-sm">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-3 text-left">
                <span className="grid h-12 w-12 shrink-0 place-items-end overflow-hidden bg-tint">
                  <img src={g.art} alt="" className="mx-auto h-[46px] object-contain" />
                </span>
                <span>
                  <b className="block text-[17px] font-extrabold text-navy">{g.name}</b>
                  <span className="text-[13px] text-muted-foreground">{g.services.length} services</span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-2">
              {g.services.map((s) => <Row key={s.href} s={s} />)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
};

/** C. The menu board: a printed price list on a taped sheet. */
export const CardsC = () => (
  <div className="relative mx-auto max-w-[920px] border-2 border-navy bg-white px-5 pb-6 pt-8 shadow-offset sm:px-10 sm:pb-8 sm:pt-10">
    <Tape width={120} tilt={-3} className="-top-3 left-10" />
    <Tape width={90} tilt={4} className="-top-3 right-12 hidden sm:block" />
    <div className="flex items-baseline justify-between border-b-4 border-navy pb-3">
      <span className="text-[22px] font-black tracking-[-0.04em] text-navy sm:text-[28px]">Care at home</span>
      <span className="label-caps">Starting prices</span>
    </div>
    {GROUPS.map((g) => (
      <section key={g.name} className="mt-7">
        <div className="flex items-end gap-3">
          <img src={g.art} alt="" loading="lazy" className="h-[54px] object-contain" />
          <NotchTag tone="navy" size="sm" className="mb-1.5">{g.name}</NotchTag>
        </div>
        <div className="mt-2">
          {g.services.map((s) => (
            <Link key={s.href} to={s.href} className="group flex flex-col gap-1.5 border-t border-hairline py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <span className="min-w-0">
                <b className="block text-[17px] font-extrabold leading-[1.2] text-navy group-hover:text-brand">
                  {s.title} <span aria-hidden="true" className="text-brand">→</span>
                </b>
                <span className="mt-0.5 block text-[14px] leading-[1.45] text-body">{s.line}</span>
              </span>
              <span className="shrink-0 sm:pt-0.5 sm:text-right"><PriceText s={s} small /></span>
            </Link>
          ))}
        </div>
      </section>
    ))}
    <p className="mt-6 border-t-4 border-navy pt-4 text-[14px] font-bold text-navy">
      Every care plan starts with a ₦35,000 home care needs assessment.
    </p>
  </div>
);

/** Mix: A's price-tag cards on desktop, C's menu on a phone. */
export const CardsMix = () => (
  <>
    <div className="hidden lg:block"><CardsA /></div>
    <div className="lg:hidden"><CardsC /></div>
  </>
);


/** Phone option 1: A's cards in a swipe row, with a counter. */
const SwipeA = () => {
  const [at, setAt] = useState(1);
  return (
    <div>
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.min(ALL.length, Math.round(el.scrollLeft / (el.scrollWidth / ALL.length)) + 1));
        }}
        className="-mx-[22px] flex snap-x snap-mandatory gap-5 overflow-x-auto px-[22px] pb-4 pt-3 [scrollbar-width:none]"
      >
        {ALL.map((s) => (
          <Link key={s.href} to={s.href} className="relative flex w-[78%] shrink-0 snap-start flex-col border-2 border-navy bg-white shadow-offset-sm">
            <div className="relative m-2 mb-0 h-[130px] bg-tint">
              <img src={s.art} alt="" className="absolute bottom-0 left-4 h-[120px] object-contain" />
            </div>
            <span className={cn("mc-tag-left absolute -right-2 top-[104px] rotate-[-4deg] py-1.5 pl-5 pr-3 shadow-offset-sm", s.price ? "bg-white" : "bg-tint")}>
              <PriceText s={s} small />
            </span>
            <div className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3">
              <h3 className="text-[20px] leading-[1.1] tracking-[-0.04em]">{s.title}</h3>
              <p className="text-[14px] leading-[1.5] text-body">{s.line}</p>
              <span className="mt-auto pt-1.5 text-[14px] font-extrabold text-brand">See more <span aria-hidden="true">→</span></span>
            </div>
          </Link>
        ))}
      </div>
      <p className="label-caps mt-1 tabular-nums">
        {at} of {ALL.length} <span aria-hidden="true" className="ml-1 text-brand">swipe →</span>
      </p>
    </div>
  );
};

/** Phone option 2: two-column tiles. */
const Tiles = () => (
  <div className="grid grid-cols-2 gap-3">
    {ALL.map((s) => (
      <Link key={s.href} to={s.href} className="flex flex-col border-2 border-navy bg-white shadow-offset-sm active:bg-tint">
        <div className="relative m-1.5 mb-0 h-[92px] bg-tint">
          <img src={s.art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[86px] object-contain" />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <b className="text-[15px] font-extrabold leading-[1.15] text-navy">{s.title}</b>
          <span className="mt-auto pt-1 text-[13px]">
            {s.price ? (
              <span className="whitespace-nowrap">
                {s.from && <span className="mr-1 text-[11px] font-bold text-ink">from</span>}
                <b className="font-extrabold text-price">{s.price}</b>
              </span>
            ) : (
              <span className="text-[12px] font-bold text-muted-foreground">Quoted after assessment</span>
            )}
          </span>
        </div>
      </Link>
    ))}
  </div>
);

/** Phone option 3: compact rows. */
const Rows = () => <div className="border-2 border-navy bg-white px-4 shadow-offset-sm">{ALL.map((s) => <Row key={s.href} s={s} />)}</div>;

const desktopA = (Phone: () => JSX.Element) => () => (
  <>
    <div className="hidden lg:block"><CardsA /></div>
    <div className="lg:hidden"><Phone /></div>
  </>
);

export const CARD_MOCKS: Record<string, () => JSX.Element> = {
  a: CardsA, b: CardsB, c: CardsC, mix: CardsMix,
  m1: desktopA(SwipeA), m2: desktopA(Tiles), m3: desktopA(Rows),
};
