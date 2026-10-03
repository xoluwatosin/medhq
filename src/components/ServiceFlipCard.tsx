import { useId, useState, type CSSProperties } from "react";
import { Hand } from "lucide-react";
import mOSoft from "@/assets/brand/m-o-soft.svg";
import mCrossSoft from "@/assets/brand/m-cross-soft.svg";
import mFullSoft from "@/assets/brand/m-full-soft.svg";
import mInfSoft from "@/assets/brand/m-inf-soft.svg";

interface ServiceFlipCardWatermark {
  src: string;
  className?: string;
  style?: CSSProperties;
}

interface ServiceFlipCardProps {
  title: string;
  description: string;
  href?: string;
  image: string;
  showLearnMore?: boolean;
  watermark?: ServiceFlipCardWatermark | null;
}

// Subtle brand marks, spread deterministically so every page varies but stays calm.
const defaultWatermarks: (ServiceFlipCardWatermark | null)[] = [
  {
    src: mOSoft,
    className: "w-[86px] opacity-20 md:w-[168px] md:opacity-25",
    style: { right: "-26px", bottom: "-28px" },
  },
  {
    src: mCrossSoft,
    className: "w-[70px] opacity-[0.16] md:w-[132px] md:opacity-20",
    style: { left: "-18px", top: "-22px" },
  },
  null,
  {
    src: mFullSoft,
    className: "w-[92px] opacity-[0.16] md:w-[170px] md:opacity-20",
    style: { left: "-24px", bottom: "-26px" },
  },
  {
    src: mInfSoft,
    className: "w-[80px] opacity-[0.16] md:w-[150px] md:opacity-20",
    style: { right: "-22px", top: "-20px" },
  },
];

const pickWatermark = (title: string) => {
  let sum = 0;
  for (let i = 0; i < title.length; i += 1) sum = (sum * 31 + title.charCodeAt(i)) % 9973;
  return defaultWatermarks[sum % defaultWatermarks.length];
};

const ServiceFlipCard = ({ title, description, href, image, showLearnMore = false, watermark }: ServiceFlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const backId = useId();
  const mark = watermark === undefined ? pickWatermark(title) : watermark;


  return (
    <div 
      className="flip-card-container cursor-pointer h-36 md:h-72"
      onClick={() => setIsFlipped(!isFlipped)}
      onMouseEnter={() => { if (window.matchMedia("(min-width: 768px)").matches) setIsFlipped(true); }}
      onMouseLeave={() => { if (window.matchMedia("(min-width: 768px)").matches) setIsFlipped(false); }}
    >
      <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
        {/* Front - Image with title overlay */}
        <div className="flip-card-front overflow-hidden kit-curve" aria-hidden={isFlipped}>
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-navy/55" />
          <div className="absolute bottom-0 left-0 right-0 flex items-end p-4 justify-center md:p-6 md:justify-between">
            <h3 className="font-semibold tracking-[-0.01em] text-white drop-shadow-lg text-base text-center md:text-xl md:text-left">{title}</h3>
            <button
              type="button"
              aria-expanded={isFlipped}
              aria-controls={backId}
              aria-label={`Show details for ${title}`}
              tabIndex={isFlipped ? -1 : 0}
              onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
              className="absolute right-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-0 md:right-4 md:bottom-4"
            >
              <Hand className="w-4 h-4 text-white/70 -rotate-12" />
            </button>
          </div>
        </div>
        
        {/* Back - Description */}
        <div id={backId} aria-hidden={!isFlipped} className="flip-card-back bg-navy flex flex-col items-center justify-center text-center kit-curve overflow-hidden p-4 md:p-6">
          {mark && (
            <img
              src={mark.src}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className={`pointer-events-none absolute ${mark.className ?? ""}`}
              style={mark.style}
            />
          )}
          <h3 className="relative font-semibold text-white text-base mb-2 md:text-xl md:mb-4">{title}</h3>
          
          <p className="relative leading-relaxed text-body-navy text-xs mb-2 md:text-sm md:mb-4">
            {description}
          </p>
          {showLearnMore && href && (
            <a 
              href={href}
              onClick={(e) => e.stopPropagation()}
              tabIndex={isFlipped ? 0 : -1}
              {...(href.startsWith('http') ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label={href.startsWith('http') ? `Visit the ${title} website` : `Read about ${title}`}
              className="inline-flex items-center gap-2 font-medium text-outline-navy hover:text-white transition-colors underline underline-offset-4 text-xs md:text-sm"
            >
              {href.startsWith('http') ? `Visit ${title} site →` : `Read about ${title} →`}
            </a>
          )}

        </div>
      </div>
    </div>
  );
};

export default ServiceFlipCard;
