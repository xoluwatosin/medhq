/**
 * Hero watermark
 *
 * Every candidate record carries the same navy plate, which makes a wall of
 * them read as one page. The watermark is the one thing allowed to differ, but
 * only the real brand glyphs are used - the O, the cross, the infinity and the
 * whole mark, in the pale fills made for navy. Nothing is drawn by hand. The
 * variation is placement and crop, picked from the person's own id so the same
 * record always wears the same figure.
 *
 * Rules kept from the design guide: opacity 0.10 to 0.16, the junction of the
 * cross and the crossing point of the infinity stay intact, and no placement
 * runs behind the name or the fact rows.
 */
import { CSSProperties } from "react";

import markCross from "@/assets/brand/m-cross-soft.svg";
import markFull from "@/assets/brand/m-full-soft.svg";
import markInf from "@/assets/brand/m-inf-soft.svg";
import markO from "@/assets/brand/m-o-soft.svg";

/** Stable, spread-out hash so neighbouring ids do not land on the same figure. */
const hashOf = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

type Variant = { src: string; style: CSSProperties };

/**
 * Six placements of the four glyphs. The O may be cropped freely; the cross,
 * the infinity and the whole mark are shown whole so their junctions read.
 */
const VARIANTS: Variant[] = [
  {
    // The O rising from the bottom edge, centre right.
    src: markO,
    style: { bottom: "-58%", right: "16%", width: "clamp(210px, 30%, 380px)", opacity: 0.14 },
  },
  {
    // The O cropped at the top right corner.
    src: markO,
    style: { top: "-46%", right: "-6%", width: "clamp(210px, 30%, 380px)", opacity: 0.13 },
  },
  {
    // The cross whole, sitting low on the right, clear of the action row.
    src: markCross,
    style: { bottom: "4%", right: "1%", width: "clamp(100px, 12%, 150px)", opacity: 0.1 },
  },
  {
    // The cross whole, larger, sitting inside the lower right.
    src: markCross,
    style: { bottom: "5%", right: "16%", width: "clamp(110px, 13%, 165px)", opacity: 0.1 },
  },
  {
    // The infinity whole, running low across the right half.
    src: markInf,
    style: { bottom: "10%", right: "3%", width: "clamp(250px, 36%, 440px)", opacity: 0.12 },
  },
  {
    // The whole mark, held clear on the lower right.
    src: markFull,
    style: { bottom: "4%", right: "2%", width: "clamp(120px, 16%, 200px)", opacity: 0.11 },
  },
];

/** The figure this record wears, chosen once from its id. */
export const heroWatermarkFor = (seed: string | null | undefined): Variant =>
  VARIANTS[hashOf(seed || "medicconnect") % VARIANTS.length];

export const MuHeroWatermark = ({ seed }: { seed: string | null | undefined }) => {
  const variant = heroWatermarkFor(seed);
  return (
    <img loading="lazy" decoding="async"
      src={variant.src}
      alt=""
      aria-hidden
      draggable={false}
      className="pointer-events-none absolute select-none"
      style={variant.style}
    />
  );
};

export default MuHeroWatermark;
