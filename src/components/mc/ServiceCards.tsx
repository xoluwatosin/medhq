import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * A list of services with starting prices, built twice:
 *  - desktop: illustrated cards with the price on a luggage tag, slightly tilted;
 *  - phones: two-column tiles with the illustration, name and price only.
 * Every published price shows "from" and no unit: these are starting prices
 * for a service line, and the care plan sets the final figure. Leave `price`
 * empty when no price is published; the card then says it is quoted after
 * assessment.
 */
export interface ServiceCard {
  title: string;
  /** One line, shown on desktop only. */
  line: string;
  href: string;
  /** "₦20,000", or "" when quoted after assessment. */
  price: string;
  art: string;
}

const Price = ({ s, size }: { s: ServiceCard; size: "tag" | "tile" }) =>
  s.price ? (
    <span className="whitespace-nowrap tabular-nums">
      <span className={cn("mr-1 font-bold text-ink", size === "tag" ? "text-[12px]" : "text-[11px]")}>from</span>
      <b className={cn("font-extrabold tracking-[-0.03em] text-price", size === "tag" ? "text-[20px]" : "text-[15px]")}>{s.price}</b>
    </span>
  ) : (
    <span className={cn("block font-bold leading-tight text-muted-foreground", size === "tag" ? "max-w-[92px] text-[12px]" : "text-[12px]")}>
      Quoted after assessment
    </span>
  );

const TILTS = [-1.2, 0.8, -0.6];

const ServiceCards = ({ services }: { services: ServiceCard[] }) => (
  <>
    {/* Desktop: price-tag cards. */}
    <div className="hidden gap-8 sm:grid-cols-2 lg:grid lg:grid-cols-3">
      {services.map((s, i) => (
        <Link
          key={s.href}
          to={s.href}
          style={{ ["--mc-tilt" as string]: `${TILTS[i % TILTS.length]}deg` }}
          className="mc-tilt group relative flex flex-col border-2 border-navy bg-white shadow-offset"
        >
          <div className="relative m-2.5 mb-0 h-[150px] bg-tint">
            {/* Art stands left so the price tag on the right never covers a face. */}
            <img src={s.art} alt="" className="absolute bottom-0 left-5 h-[138px] max-w-[52%] object-contain object-left-bottom" />
          </div>
          <span
            className={cn(
              "mc-tag-left absolute -right-3 top-6 rotate-[5deg] py-2 pl-6 pr-4 shadow-offset-sm",
              s.price ? "bg-white" : "bg-tint",
            )}
          >
            <Price s={s} size="tag" />
          </span>
          <div className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
            <h3 className="text-[22px] leading-[1.1] tracking-[-0.04em]">{s.title}</h3>
            <p className="text-[15px] leading-[1.55] text-body">{s.line}</p>
            <span className="mt-auto pt-2 text-[15px] font-extrabold text-brand transition-colors duration-200 group-hover:text-navy">
              See {s.title.toLowerCase()} <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>

    {/* Phones: two-column tiles. */}
    <div className="grid grid-cols-2 gap-3 lg:hidden">
      {services.map((s) => (
        <Link
          key={s.href}
          to={s.href}
          className="flex flex-col border-2 border-navy bg-white shadow-offset-sm transition-colors duration-150 active:bg-tint"
        >
          <div className="relative m-1.5 mb-0 h-[92px] bg-tint">
            <img src={s.art} alt="" loading="lazy" className="absolute inset-x-0 bottom-0 mx-auto h-[86px] object-contain" />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3">
            <b className="text-[15px] font-extrabold leading-[1.15] text-navy">{s.title}</b>
            <span className="mt-auto pt-1">
              <Price s={s} size="tile" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  </>
);

export default ServiceCards;
