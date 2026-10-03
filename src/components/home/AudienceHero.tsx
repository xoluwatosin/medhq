import { ReactNode } from "react";
import oSoft from "@/assets/brand/m-o-soft.svg";

interface AudienceHeroProps {
  /** Placement E from the guide: O rising from the bottom edge, centred. */
  variant?: "centred" | "split";
  children: ReactNode;
}

/**
 * Navy full bleed hero with the pale mark as a watermark.
 *
 * The negative top margin must match the sticky header's full height so the
 * navy runs right to the top edge of the page and no cream band shows above
 * the nav pills. Header height = vertical padding * 2 + pill height:
 *   mobile  12 * 2 + 56 = 80
 *   desktop 26 * 2 + 62 = 114
 */
const AudienceHero = ({ variant = "centred", children }: AudienceHeroProps) => (
  <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[112px] sm:-mt-[114px] sm:pt-[164px]">
    <img
      src={oSoft}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute opacity-[0.13]"
      style={
        variant === "centred"
          ? { width: "620px", left: "50%", bottom: "-300px", transform: "translateX(-50%)" }
          : { width: "560px", right: "-260px", top: "50%", transform: "translateY(-50%)" }
      }
    />
    <div className="relative mx-auto max-w-[1440px] px-[22px] pb-16 sm:px-[50px] sm:pb-24">{children}</div>
  </section>
);

export default AudienceHero;
