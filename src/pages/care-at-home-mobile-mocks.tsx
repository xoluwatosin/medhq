// TEMPORARY: three phone-only heroes for /care-at-home, switched with ?m=1|2|3.
// Desktop is unchanged. Delete this file once a direction is chosen.
import KitPillHeading from "@/components/kit/KitPillHeading";
import { Highlight, PillSticker, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";

const lead =
  "Vetted nurses, nannies and carers placed in your home, usually within 48 hours. Services may begin with a ₦35,000 care needs assessment.";

const Shell = ({ children, pb = "pb-10" }: { children: React.ReactNode; pb?: string }) => (
  <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] lg:hidden">
    <Watermark glyph="o" size={360} opacity={0.12} className="-right-[150px] -top-[90px]" />
    <div className={`relative px-[22px] ${pb}`}>{children}</div>
  </section>
);

/** 1. Overlap: left-aligned, the family on the hero's edge, tiles rising over it. */
const Overlap = () => (
  <Shell pb="pb-[86px]">
    <KitPillHeading text="Care that comes to your door" accent={[0]} align="left" />
    <p className="mt-5 max-w-[58%] text-[15px] leading-[1.55] text-body-navy">{lead}</p>
    <img src={art.familyDoorNurse} alt="" className="pointer-events-none absolute bottom-[70px] -right-4 h-[170px] max-w-[46%] object-contain object-right-bottom" />
  </Shell>
);

/** 2. Big and simple: plain large type, the illustration peeking from the corner. */
const BigType = () => (
  <Shell pb="pb-12">
    <h1 className="max-w-[9ch] text-[54px] leading-[0.94] tracking-[-0.06em] !text-white">
      Care that comes to your <Highlight>door</Highlight>.
    </h1>
    <p className="mt-6 max-w-[34ch] text-[15.5px] leading-[1.55] text-body-navy">{lead}</p>
    <img src={art.familyDoorNurse} alt="" className="pointer-events-none absolute -right-3 top-1 h-[150px] max-w-[40%] object-contain object-right-top" />
  </Shell>
);

/** 3. Stickers: the promise as three quick stickers instead of a paragraph. */
const Stickers = () => (
  <Shell pb="pb-12">
    <KitPillHeading text="Care that comes to your door" accent={[0]} align="left" />
    <div className="mt-7 flex flex-wrap gap-x-3 gap-y-4">
      <PillSticker tone="blue" tilt={-3}>Vetted professionals</PillSticker>
      <PillSticker tone="tint" tilt={2}>Usually within 48 hours</PillSticker>
      <PillSticker tone="blue" tilt={-1.5}>₦35,000 care needs assessment</PillSticker>
    </div>
    <p className="sr-only">{lead}</p>
  </Shell>
);

export const MOBILE_HEROES: Record<string, { Hero: () => JSX.Element; overlap?: boolean }> = {
  "1": { Hero: Overlap, overlap: true },
  "2": { Hero: BigType },
  "3": { Hero: Stickers },
};
