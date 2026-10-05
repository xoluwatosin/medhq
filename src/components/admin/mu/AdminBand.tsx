// The navy band every admin page opens with: the site's hero, sized for
// work. A white tag names the area, the title is set as tilted word blocks,
// and a character from the area stands on the band's bottom edge. The band
// runs straight on from the navy top bar and tab rail, so the page reads as
// one surface from the menu to the first card.
import { createContext, ReactNode, useContext } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { adminDomains, locateRoute } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

/** One character per area, standing on the band. */
const AREA_ART: Record<string, string> = {
  overview: art.coordinatorDeskPhoneCutout,
  care: art.charNurse,
  talent: art.nurseManKit,
  workforce: art.carerManJacket,
  programmes: art.nurseFilmingExplainer,
  inbox: art.receptionistFrontDesk,
  communications: art.nurseStreetMap,
  content: art.doctorWoman,
  finance: art.hospitalManagerClipboard,
  insights: art.researchCoordinatorTablet,
  administration: art.charDoctor,
};

/**
 * The layout keeps a slot for the band directly under the tab rail, full
 * width, whatever column the page itself sits in. Bands render into it; with
 * no slot (an embedded screen) they render in place.
 */
export const BandSlotContext = createContext<HTMLElement | null>(null);

export const InBandSlot = ({ children }: { children: ReactNode }) => {
  const slot = useContext(BandSlotContext);
  return slot ? createPortal(children, slot) : <>{children}</>;
};

/** Lines the band's content up with the page column under it. */
export const BAND_INNER = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8";

export const useAreaLabel = () => {
  const { pathname } = useLocation();
  const domain = locateRoute(adminDomains, pathname).domain;
  return { label: domain?.label ?? "Admin Centre", key: domain?.key ?? "overview" };
};

export const AdminBand = ({
  title,
  description,
  actions,
  eyebrow,
  backTo,
  backLabel = "Back",
  breadcrumb,
  id,
  art: artOverride,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** The white tag; defaults to the area's name. */
  eyebrow?: string;
  backTo?: string;
  backLabel?: string;
  breadcrumb?: ReactNode;
  id?: string;
  /** A character for this page; null for none. Defaults to the area's. */
  art?: string | null;
  /** Anything that belongs inside the band under the actions, e.g. facts. */
  children?: ReactNode;
}) => {
  const area = useAreaLabel();
  const figure = artOverride === null ? null : artOverride ?? AREA_ART[area.key];
  const words = title.split(" ").filter(Boolean);
  return (
    <InBandSlot>
    <header className="admin-band relative overflow-hidden bg-navy pt-6 sm:pt-8">
      <Watermark glyph="o" size={360} opacity={0.1} className="-right-[110px] -top-[80px]" />
      <div className={cn("relative flex items-end gap-6", BAND_INNER)}>
        <div className={cn("min-w-0 flex-1", children ? "pb-6" : "pb-8 sm:pb-10")}>
          {breadcrumb}
          {backTo && (
            <Link to={backTo} className="mb-3 inline-flex min-h-9 items-center gap-1.5 text-[13.5px] font-bold text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
            </Link>
          )}
          <div>
            <span className="inline-flex"><NotchTag tone="white" size="sm">{eyebrow ?? area.label}</NotchTag></span>
          </div>
          <div className="mt-3.5">
            <KitPillHeading id={id} text={title} accent={[words.length - 1]} align="left" size="md" />
          </div>
          {description && <p className="mt-3.5 max-w-2xl text-[15px] leading-[1.55] text-body-navy">{description}</p>}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div>}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {figure && (
          <img
            src={figure}
            alt=""
            aria-hidden="true"
            className="pointer-events-none hidden h-[150px] w-auto shrink-0 self-end object-contain object-bottom md:block lg:mr-[3%] lg:h-[180px]"
          />
        )}
      </div>
    </header>
    </InBandSlot>
  );
};

export default AdminBand;
