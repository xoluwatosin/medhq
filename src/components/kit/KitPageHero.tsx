import { ReactNode } from "react";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { Watermark } from "@/components/mc/brand";
import { cn } from "@/lib/utils";

/**
 * The navy hero for the smaller public pages (legal, creator, matchmakers,
 * unsubscribe): the same band, eyebrow and tilted-word heading as About and
 * Contact. A character or scene can stand on the band's bottom edge, the way
 * the larger pages carry their illustration. Sits directly under MedicHeader,
 * which floats over it.
 */
const KitPageHero = ({
  eyebrow, title, accent = [], lead, children, glyph = "o", art, artClassName,
}: {
  eyebrow: string;
  title: string;
  /** Zero based indices of the words filled in brand blue. */
  accent?: number[];
  lead?: ReactNode;
  /** Buttons or a line under the lead. */
  children?: ReactNode;
  glyph?: "o" | "cross" | "inf" | "full";
  /** A character or scene from the clip art set, standing on the band. */
  art?: string;
  /** Size overrides for the art. */
  artClassName?: string;
}) => (
  <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
    <Watermark glyph={glyph} size={460} opacity={0.12} className="-right-[150px] -top-[40px]" />
    <div className="relative mx-auto flex max-w-[1440px] items-end gap-8 px-[22px] sm:px-[50px]">
      <div className={cn("min-w-0 max-w-[820px] flex-1 pb-14 sm:pb-20", art && "pb-[150px] md:pb-20")}>
        <p className="eyebrow text-brand-soft">{eyebrow}</p>
        <div className="mt-3 lg:mt-4">
          <KitPillHeading text={title} accent={accent} align="left" size={title.split(" ").length > 4 ? "md" : "lg"} />
        </div>
        {lead && (
          <p className="mt-5 max-w-[56ch] text-[16px] leading-[1.6] text-body-navy sm:text-[19px]">{lead}</p>
        )}
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
      {art && (
        <img
          src={art}
          alt=""
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 right-[22px] h-[140px] w-auto object-contain object-bottom md:static md:ml-auto md:h-[250px] md:shrink-0 lg:mr-[4%] lg:h-[300px]",
            artClassName,
          )}
        />
      )}
    </div>
  </section>
);

export default KitPageHero;
