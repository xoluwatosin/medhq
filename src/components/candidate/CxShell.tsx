// The candidate shell.
//
// Desktop: a 244px navy rail, one white pill for the active page, a red count
// badge only where something needs doing. Mobile: a navy header with a back
// chevron and at most one right hand action, a four item tab bar at the
// bottom, and the primary action in a sticky footer rather than in the flow.
import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, FileText, CalendarDays, CalendarCheck, Sliders, Briefcase, ClipboardList, User, ChevronLeft, LogOut, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import markSoft from "@/assets/brand/m-o-soft.svg";
import { Watermark } from "@/components/mc/brand";
import { art as clipArt } from "@/components/mc/art";

export type CxNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Only render a count when something needs doing. Zero is never shown. */
  needs?: number;
};

export const cxNav: CxNavItem[] = [
  { title: "Home", url: "/portal", icon: Home },
  { title: "Documents", url: "/portal/documents", icon: FileText },
  { title: "Your availability", url: "/portal/availability", icon: CalendarDays },
  { title: "Work preferences", url: "/portal/preferences", icon: Sliders },
  { title: "Offers", url: "/portal/offers", icon: Briefcase },
  
  { title: "Applications", url: "/portal/applications", icon: ClipboardList },
  { title: "Your details", url: "/portal/details", icon: User },
];

// The four that earn a thumb on a five inch phone.
const MOBILE_TABS = ["/portal", "/portal/documents", "/portal/availability", "/portal/offers"];

// Short tab labels, written out properly rather than trimmed at runtime.
const TAB_LABEL: Record<string, string> = {
  "/portal": "Home",
  "/portal/documents": "Documents",
  "/portal/availability": "Availability",
  "/portal/preferences": "Preferences",
  "/portal/offers": "Offers",
  "/portal/applications": "Applications",
  "/portal/details": "Details",
};

/** The object standing in each page's hero. */
const PAGE_ART: Record<string, string> = {
  "/portal/documents": clipArt.objFolderDocuments,
  "/portal/availability": clipArt.objCalendarSeven,
  "/portal/preferences": clipArt.objHandsHeart,
  "/portal/offers": clipArt.objHandshake,
  "/portal/applications": clipArt.objClipboardChecks,
  "/portal/details": clipArt.objIdVerification,
};

const isActive = (pathname: string, url: string) =>
  url === "/portal" ? pathname === "/portal" : pathname.startsWith(url);

const Badge = ({ count }: { count?: number }) =>
  count && count > 0 ? (
    <span className="cx-pill ml-auto inline-flex min-w-5 items-center justify-center bg-price px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
      {count}
    </span>
  ) : null;

/** One navy surface may carry one oversized mark, bled off a corner, quiet. */
export const CxNavyWatermark = () => (
  <img
    src={markSoft}
    alt=""
    aria-hidden
    className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 opacity-[0.13]"
  />
);

export const CxShell = ({
  title,
  eyebrow,
  intro,
  heroTitle,
  hero,
  art,
  back,
  headerAction,
  footer,
  nav = cxNav,
  children,
}: {
  title: string;
  eyebrow?: string;
  /** One line under the title in the desktop hero. */
  intro?: string;
  /** The desktop hero headline when it should differ from the page title. */
  heroTitle?: string;
  /** Extra hero content on desktop, below the headline (Home's readiness). */
  hero?: ReactNode;
  /** A person or object standing at the right of the desktop hero. */
  art?: string;
  /** Route to step back to. Renders the mobile back chevron. */
  back?: string;
  headerAction?: ReactNode;
  /** The one primary action. Sticky at the foot on mobile. */
  footer?: ReactNode;
  nav?: CxNavItem[];
  children: ReactNode;
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tabs = nav.filter((i) => MOBILE_TABS.includes(i.url));
  const heroArt = art ?? PAGE_ART[Object.keys(PAGE_ART).find((u) => pathname.startsWith(u)) ?? ""];

  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login"));

  return (
    <div className="cx cx-portal flex min-h-dvh w-full flex-col bg-white">
      {/* Desktop: a navy hero with the sections as tabs along its top. */}
      <header className="relative hidden overflow-hidden bg-navy md:block">
        <Watermark glyph="inf" size={620} opacity={0.12} className="-right-[200px] -top-[180px]" />
        <div className="relative mx-auto flex max-w-[1240px] items-center gap-6 px-10 pt-6">
          <Link to="/portal" className="shrink-0">
            <img src={logoWhite} alt="Medic Connect" className="w-[132px]" />
          </Link>
          <nav aria-label="Candidate portal" className="flex flex-1 flex-wrap items-center gap-1">
            {nav.map((item) => {
              const active = isActive(pathname, item.url);
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-10 items-center gap-2 px-3 text-[14px] font-extrabold transition-colors",
                    active ? "bg-white text-navy shadow-[4px_4px_0_hsl(var(--brand))]" : "text-body-navy hover:bg-white/10 hover:text-white",
                  )}
                >
                  {TAB_LABEL[item.url] ?? item.title.replace("Your ", "").replace(/^\w/, (c) => c.toUpperCase())}
                  {item.needs ? (
                    <span className="grid h-5 min-w-5 place-items-center bg-price px-1 text-[11px] font-black text-white">{item.needs}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <button type="button" onClick={signOut} className="flex min-h-10 shrink-0 items-center gap-2 text-[14px] font-bold text-body-navy hover:text-white">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

        <div className="relative mx-auto max-w-[1240px] px-10 pb-12 pt-12">
          <div className={cn("max-w-[680px]", heroArt && "pr-6")}>
            {eyebrow && <p className="eyebrow !text-brand-soft">{eyebrow}</p>}
            <h1 className="mt-3 text-[52px] leading-[1] tracking-[-0.055em] !text-white">{heroTitle ?? title}</h1>
            {intro && <p className="mt-4 max-w-[56ch] text-[18px] leading-[1.55] text-body-navy">{intro}</p>}
            {hero && <div className="mt-7">{hero}</div>}
          </div>
          {heroArt && (
            <img
              src={heroArt}
              alt=""
              className={cn(
                "pointer-events-none absolute right-10 object-contain lg:right-[90px]",
                art ? "bottom-0 h-[230px] lg:h-[260px]" : "bottom-10 h-[150px] rotate-[-6deg] lg:h-[180px]",
              )}
            />
          )}
        </div>
      </header>

      {/* Phones: one slim bar. */}
      <header
        className="sticky top-0 z-30 flex items-center gap-2 bg-navy px-3 py-3 md:hidden"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        {back ? (
          <button type="button" onClick={() => navigate(back)} aria-label="Go back" className="flex h-11 w-11 items-center justify-center text-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <img src={logoWhite} alt="Medic Connect" className="ml-1 h-[22px] w-auto" />
        )}
        <p className="flex-1 truncate text-center text-[17px] font-extrabold tracking-[-0.03em] text-white">{title}</p>
        <div className="flex min-w-11 items-center justify-end pr-1">
          {headerAction ?? (
            <button type="button" onClick={signOut} aria-label="Sign out" className="flex h-11 w-11 items-center justify-center text-white/90 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      <main className="min-w-0 flex-1 px-[18px] py-6 md:px-0 md:py-12">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 md:px-10">{children}</div>
      </main>

      {footer && (
        <div className="sticky bottom-[62px] z-20 border-t-2 border-navy/10 bg-white px-[18px] py-4 md:hidden">{footer}</div>
      )}

      <nav
        className="sticky bottom-0 z-20 grid grid-cols-4 border-t-2 border-navy bg-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((item) => {
          const active = isActive(pathname, item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11.5px] font-extrabold",
                active ? "text-navy before:absolute before:inset-x-4 before:top-0 before:h-1 before:bg-brand" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{TAB_LABEL[item.url] ?? item.title.replace("Your ", "")}</span>
              {item.needs ? <span className="absolute right-[22%] top-2 h-2 w-2 bg-price" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
