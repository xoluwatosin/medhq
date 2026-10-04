// TEMPORARY: three hero treatments to compare, switched with ?hero=1|2|3.
// Delete this file once a direction is chosen.
import { Highlight, NotchTag, TapeLabel } from "@/components/mc/brand";
import { art } from "@/components/mc/art";

/** 1. Linked: the infinity from the logo joins the two words. */
const Linked = () => (
  <div className="flex flex-col gap-5 lg:gap-7">
    <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[52px] leading-[0.96] tracking-[-0.06em] !text-white sm:text-[72px] lg:gap-x-5 lg:text-[104px]">
      <span>Health</span>
      <span aria-hidden="true" className="grid h-[52px] w-[74px] place-items-center bg-brand shadow-[4px_4px_0_#fff] sm:h-[70px] sm:w-[100px] lg:h-[96px] lg:w-[138px] lg:shadow-[6px_6px_0_#fff]">
        <img src={art.infTint} alt="" className="w-[70%]" />
      </span>
      <span className="sr-only">,</span>
      <span>connected.</span>
    </h1>
    <TapeLabel tone="tint" tilt={-2} className="!text-[16px] !tracking-normal sm:!text-[20px] lg:!text-[24px]">
      Care when &amp; where you need it.
    </TapeLabel>
  </div>
);

/** 2. When and where: the two words become real things, a day and a place. */
const WhenWhere = () => (
  <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
    <div>
      <h1 className="text-[52px] leading-[0.96] tracking-[-0.06em] !text-white sm:text-[72px] lg:text-[104px]">
        Health, <Highlight>connected</Highlight>.
      </h1>
      <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-3 text-[19px] font-medium text-body-navy sm:text-[22px] lg:mt-7 lg:text-[26px]">
        Care
        <span className="inline-flex flex-col border-2 border-white bg-white text-center leading-none">
          <span className="bg-brand px-2.5 py-1 text-[10px] font-extrabold tracking-[0.2em] text-white">ANY DAY</span>
          <span className="px-2.5 py-1 text-[0.9em] font-extrabold text-navy">when</span>
        </span>
        &amp;
        <NotchTag tone="white" className="!text-[0.62em] !tracking-[0.12em]">where</NotchTag>
        you need it.
      </p>
    </div>
    {/* The places Medic Connect serves today, hung like luggage tags. */}
    <div className="flex flex-wrap gap-3 lg:justify-end lg:pb-3">
      {["Lagos", "Abuja", "Ogun", "Oyo"].map((place, i) => (
        <NotchTag key={place} tone={i % 2 ? "tint" : "blue"} tilt={i % 2 ? 3 : -3}>
          {place}
        </NotchTag>
      ))}
    </div>
  </div>
);

/** 3. Taped: huge cropped type with the promise taped across it. */
const Taped = () => (
  <div className="relative">
    <h1 className="text-[50px] uppercase leading-[0.82] tracking-[-0.07em] !text-white sm:text-[96px] lg:text-[150px]">
      Health,
      <br />
      <span className="text-tint-deep">connected.</span>
    </h1>
    <TapeLabel
      tone="blue"
      tilt={-4}
      className="mt-5 !px-4 !py-2 !text-[15px] !tracking-[0.06em] shadow-[4px_4px_0_#fff] sm:absolute sm:bottom-[18%] sm:left-[44%] sm:mt-0 sm:!text-[18px] lg:left-[46%] lg:!px-6 lg:!py-3 lg:!text-[24px]"
    >
      Care when &amp; where you need it.
    </TapeLabel>
  </div>
);

export const HERO_MOCKS: Record<string, () => JSX.Element> = { "1": Linked, "2": WhenWhere, "3": Taped };
