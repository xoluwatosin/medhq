import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Hand } from "lucide-react";
import oTint from "@/assets/brand/m-o-tint.svg";
import oSoft from "@/assets/brand/m-o-soft.svg";

export type KitBackVariant = "navy" | "brand" | "tint" | "outline";

export interface KitService {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  image: string;
  price?: string;
  /** Back face treatment. Rotated across a grid so no two neighbours read the same. */
  back?: KitBackVariant;
  /** Feature cards are used on the home page for the three top level routes. */
  feature?: boolean;
}

const backStyles: Record<
  KitBackVariant,
  { shell: string; eyebrow: string; title: string; body: string; link: string; watermark: string }
> = {
  navy: {
    shell: "bg-navy",
    eyebrow: "!text-muted-navy",
    title: "text-white",
    body: "text-body-navy",
    link: "text-outline-navy",
    watermark: "opacity-30",
  },
  brand: {
    shell: "bg-brand",
    eyebrow: "!text-white/85",
    title: "text-white",
    body: "text-white/85",
    link: "text-white",
    watermark: "opacity-20",
  },
  tint: {
    shell: "bg-tint",
    eyebrow: "!text-brand",
    title: "text-ink",
    body: "text-body",
    link: "text-brand",
    watermark: "opacity-45",
  },
  outline: {
    shell: "bg-white border-[1.5px] border-navy",
    eyebrow: "!text-brand",
    title: "text-ink",
    body: "text-body",
    link: "text-navy",
    watermark: "opacity-35",
  },
};

/**
 * Service card. The front keeps the original photographic cover with the title
 * laid over it. The back varies by `back` so a grid does not read as one block.
 * Card height matches the original: 144px on mobile, 288px from small up.
 */
const KitFlipCard = ({
  eyebrow,
  title,
  description,
  href,
  image,
  price,
  back = "navy",
  feature = false,
}: KitService) => {
  const [flipped, setFlipped] = useState(false);
  const backId = useId();
  const external = href.startsWith("http");
  // Square, with a hard offset that alternates by back treatment.
  const radius = "0";
  const s = backStyles[back];

  const faceBase =
    "absolute inset-0 overflow-hidden [backface-visibility:hidden] transition-opacity duration-200";
  const height = feature ? "h-44 sm:h-80" : "h-36 sm:h-72";
  const pad = "p-3.5 sm:p-6";

  return (
    <div
      className={`${height} cursor-pointer [perspective:1400px] ${back === "brand" || back === "tint" ? "shadow-offset-blue" : "shadow-offset"}`}
      onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) setFlipped(true); }}
      onMouseLeave={() => { if (window.matchMedia("(hover: hover)").matches) setFlipped(false); }}
      onClick={() => setFlipped((v) => !v)}
    >
      <div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{
          transition: "transform 520ms cubic-bezier(0.2, 0.7, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "none",
        }}
      >
        {/* Front: photographic cover, unchanged from the original cards. */}
        <div
          className={`${faceBase} ${flipped ? "opacity-0" : "opacity-100"}`}
          style={{ borderRadius: radius }}
          aria-hidden={flipped}
        >
          <img src={image} alt={title} loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-navy/55" />
          <div className={`absolute inset-x-0 bottom-0 ${pad}`}>
            <h3
              className="self-start bg-white px-2 py-1 font-extrabold !text-navy text-[15px] leading-[1.2] tracking-[-0.03em] sm:text-[21px]"
            >
              {title}
            </h3>
            <p className="mt-2 pr-12 flex items-center gap-2 text-[13px] text-white/80">
              Hover or tap for detail
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </p>
          </div>
          <button
            type="button"
            aria-expanded={flipped}
            aria-controls={backId}
            aria-label={`Show details for ${title}`}
            tabIndex={flipped ? -1 : 0}
            onClick={(e) => {
              e.stopPropagation();
              setFlipped((v) => !v);
            }}
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-0"
          >
            <Hand className="h-4 w-4 -rotate-12 text-white/70" aria-hidden="true" />
          </button>
        </div>

        {/* Back: varies by treatment. */}
        <div
          id={backId}
          aria-hidden={!flipped}
          className={`${faceBase} ${s.shell} [transform:rotateY(180deg)] ${
            flipped ? "opacity-100" : "opacity-0"
          }`}
          style={{ borderRadius: radius }}
        >
          <img loading="lazy" decoding="async"
            src={back === "navy" || back === "brand" ? oSoft : oTint}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute w-[200px] ${s.watermark}`}
            style={
              back === "outline"
                ? { left: "-70px", top: "-72px" }
                : { right: "-76px", bottom: "-80px" }
            }
          />
          <div className={`relative flex h-full flex-col ${pad}`}>
            <p className={`eyebrow ${s.eyebrow} !text-[10px] sm:!text-[12px]`}>{eyebrow}</p>
            <h3
              className={`line-clamp-2 font-extrabold ${s.title} mt-1.5 text-[13px] leading-[1.2] sm:mt-3 sm:text-[19px] sm:leading-[1.3]`}
            >
              {title}
            </h3>
            <p
              className={`overflow-hidden ${s.body} mt-1.5 line-clamp-2 max-h-[2.6em] text-[11px] leading-[1.3] sm:mt-3 sm:line-clamp-4 sm:max-h-none sm:text-[14.5px] sm:leading-[1.55]`}
            >
              {description}
            </p>
            <div className="mt-auto shrink-0 pt-1.5 sm:pt-3">
              {price && (
                <p className={`text-[18px] font-bold tracking-[-0.025em] ${s.title}`}>{price}</p>
              )}
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={flipped ? 0 : -1}
                  onClick={(e) => e.stopPropagation()}
                  className={`inline-block font-extrabold underline underline-offset-4 ${s.link} text-[12px] sm:text-[14px]`}
                >
                  Visit the site
                </a>
              ) : (
                <Link
                  to={href}
                  tabIndex={flipped ? 0 : -1}
                  onClick={(e) => e.stopPropagation()}
                  className={`inline-block font-extrabold underline underline-offset-4 ${s.link} text-[12px] sm:text-[14px]`}
                >
                  Read more
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitFlipCard;
