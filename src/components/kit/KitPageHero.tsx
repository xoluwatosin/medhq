import { ReactNode } from "react";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { Watermark } from "@/components/mc/brand";

/**
 * The navy hero for the smaller public pages (legal, creator, matchmakers,
 * unsubscribe): the same band, eyebrow and tilted-word heading as About and
 * Contact, without the illustration group, so a short page still opens in the
 * house style. Sits directly under MedicHeader, which floats over it.
 */
const KitPageHero = ({
  eyebrow, title, accent = [], lead, children, glyph = "o",
}: {
  eyebrow: string;
  title: string;
  /** Zero based indices of the words filled in brand blue. */
  accent?: number[];
  lead?: ReactNode;
  /** Buttons or a line under the lead. */
  children?: ReactNode;
  glyph?: "o" | "cross" | "inf" | "full";
}) => (
  <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
    <Watermark glyph={glyph} size={460} opacity={0.12} className="-right-[150px] -top-[40px]" />
    <div className="relative mx-auto max-w-[1440px] px-[22px] pb-14 sm:px-[50px] sm:pb-20">
      <div className="max-w-[820px]">
        <p className="eyebrow text-brand-soft">{eyebrow}</p>
        <div className="mt-3 lg:mt-4">
          <KitPillHeading text={title} accent={accent} align="left" size={title.split(" ").length > 4 ? "md" : "lg"} />
        </div>
        {lead && (
          <p className="mt-5 max-w-[56ch] text-[16px] leading-[1.6] text-body-navy sm:text-[19px]">{lead}</p>
        )}
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
    </div>
  </section>
);

export default KitPageHero;
