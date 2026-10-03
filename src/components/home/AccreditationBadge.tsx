import { BadgeCheck } from "lucide-react";

/**
 * The rolling accreditation seal. Text sits on a circular path and rotates
 * slowly; the tick in the centre stays upright. Decorative only, so the same
 * claim is repeated in plain text elsewhere for screen readers and crawlers.
 */
const AccreditationBadge = ({ className = "" }: { className?: string }) => (
  <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
    <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-[2px] lg:h-40 lg:w-40">
      <svg viewBox="0 0 100 100" className="animate-spin-slow absolute inset-0 h-full w-full">
        <defs>
          <path id="accreditation-ring" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <text className="fill-white text-[7.6px] font-bold uppercase" style={{ letterSpacing: "0.34em" }}>
          <textPath href="#accreditation-ring">
            HEFAMAA accredited • Insured •
          </textPath>
        </text>
      </svg>
      <BadgeCheck className="h-11 w-11 text-white lg:h-12 lg:w-12" />
    </div>
  </div>
);

export default AccreditationBadge;
