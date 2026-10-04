// TEMPORARY: three hero treatments for /care-at-home, switched with ?hero=1|2|3.
// Delete this file once a direction is chosen.
import { ReactNode } from "react";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { Highlight, TickerStrip, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";

type HeroProps = { lead: string; actions: ReactNode; lightActions: ReactNode };

/** 1. Hanging cards: a shorter navy hero; the first row of cards hangs across its edge. */
const Hanging = ({ lead, actions }: HeroProps) => (
  <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[112px] sm:-mt-[114px] sm:pt-[150px]">
    <Watermark glyph="o" size={620} opacity={0.12} className="-right-[220px] -top-[160px]" />
    <div className="relative mx-auto max-w-[920px] px-[22px] pb-12 text-center sm:px-[50px] lg:pb-[190px]">
      <KitPillHeading text="Care that comes to your door" accent={[0]} align="centre" />
      <p className="mx-auto mt-6 max-w-[58ch] text-[17px] leading-[1.6] text-body-navy sm:text-[20px]">{lead}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{actions}</div>
    </div>
  </section>
);

/** 2. The door: light hero, the headline beside a navy door with the family on its step. */
const Door = ({ lead, lightActions }: HeroProps) => (
  <section className="relative -mt-[80px] overflow-hidden bg-tint pt-[112px] sm:-mt-[114px] sm:pt-[150px]">
    <div className="relative mx-auto grid max-w-[1440px] items-end gap-10 px-[22px] sm:px-[50px] lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
      <div className="pb-4 lg:pb-20">
        <p className="eyebrow">Care at home</p>
        <h1 className="mt-4 text-[46px] leading-[0.98] tracking-[-0.055em] sm:text-[64px] xl:text-[80px]">
          Care that comes to your <Highlight>door</Highlight>.
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.6] text-body sm:text-[20px]">{lead}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">{lightActions}</div>
      </div>
      {/* The door: a navy panel with a frame and a handle; the family stands on its step. */}
      <div className="relative mx-auto h-[300px] w-full max-w-[320px] lg:h-[440px] lg:max-w-[420px]">
        <div className="absolute inset-x-6 bottom-0 top-0 border-[10px] border-b-0 border-white bg-navy shadow-[8px_0_0_hsl(var(--brand))]">
          <span className="absolute right-5 top-1/2 h-10 w-3 bg-white" />
        </div>
        <img src={art.familyDoorNurse} alt="" className="absolute bottom-0 left-1/2 h-[90%] -translate-x-1/2 object-contain" />
      </div>
    </div>
    <div aria-hidden="true" className="h-4 bg-navy" />
  </section>
);

/** 3. Ticker bridge: light hero, then the services scroll past on a blue band. */
const Ticker = ({ lead, lightActions }: HeroProps) => (
  <>
    <section className="relative -mt-[80px] overflow-hidden bg-tint pt-[112px] sm:-mt-[114px] sm:pt-[150px]">
      <Watermark glyph="oTint" size={560} opacity={1} className="-left-[200px] -top-[120px]" />
      <div className="relative mx-auto max-w-[920px] px-[22px] pb-14 text-center sm:px-[50px] sm:pb-20">
        <p className="eyebrow">Care at home</p>
        <h1 className="mt-4 text-[46px] leading-[0.98] tracking-[-0.055em] sm:text-[64px] xl:text-[80px]">
          Care that comes to your <Highlight>door</Highlight>.
        </h1>
        <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-[1.6] text-body sm:text-[20px]">{lead}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{lightActions}</div>
      </div>
    </section>
    <TickerStrip
      tone="blue"
      items={["Clinical home care", "Post-surgical care", "Antenatal care", "Postnatal and Omugwo", "Nanny and childcare", "Eldercare", "Caregivers"]}
    />
  </>
);

export const HERO_MOCKS: Record<string, { Hero: (p: HeroProps) => JSX.Element; overlap?: boolean }> = {
  "1": { Hero: Hanging, overlap: true },
  "2": { Hero: Door },
  "3": { Hero: Ticker },
};
