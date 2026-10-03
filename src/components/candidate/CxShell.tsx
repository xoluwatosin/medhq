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
  "/portal/offers": "Offers",
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
  back,
  headerAction,
  footer,
  nav = cxNav,
  children,
}: {
  title: string;
  eyebrow?: string;
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

  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login"));

  return (
    <div className="cx flex min-h-dvh w-full bg-navy md:bg-desk">
      {/* Desktop rail */}
      <aside className="relative hidden w-[244px] shrink-0 flex-col overflow-hidden bg-navy px-4 py-7 md:flex">
        <CxNavyWatermark />
        <div className="relative z-10 flex h-full flex-col">
          <img src={logoWhite} alt="Medic Connect" className="mb-8 ml-2 w-[118px]" />
          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active = isActive(pathname, item.url);
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "cx-control flex min-h-11 items-center gap-2.5 px-3 text-[14.5px] transition-colors",
                    active
                      ? "bg-white font-extrabold text-ink"
                      : "font-semibold text-body-navy hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                  <Badge count={item.needs} />
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={signOut}
            className="cx-control mt-auto flex min-h-11 items-center gap-2.5 px-3 text-[14.5px] font-semibold text-body-navy transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header
          className="relative flex items-center gap-2 overflow-hidden bg-navy px-3 py-3.5 md:hidden"
          style={{ paddingTop: "calc(0.875rem + env(safe-area-inset-top))" }}
        >
          {back ? (
            <button
              type="button"
              onClick={() => navigate(back)}
              aria-label="Go back"
              className="flex h-11 w-11 items-center justify-center text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <img src={logoWhite} alt="Medic Connect" className="ml-1 h-[22px] w-auto" />
          )}
          <h1 className="flex-1 truncate text-center text-[16px] font-semibold tracking-[-0.02em] text-white md:hidden">
            {title}
          </h1>
          <div className="flex min-w-11 items-center justify-end pr-1">
            {headerAction ?? (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                className="flex h-11 w-11 items-center justify-center text-white/90 transition-colors hover:text-white"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>

        </header>

        <main className="min-w-0 flex-1 bg-desk px-[18px] py-6 md:px-10 md:py-[34px]">
          <div className="mx-auto flex w-full max-w-[900px] flex-col gap-[26px]">
            <div className="hidden md:block">
              {eyebrow && (
                <p className="cx-eyebrow mb-2 text-brand">{eyebrow}</p>
              )}
              <h1 className="cx-heading text-[27px] text-ink">{title}</h1>
            </div>
            {children}
          </div>
        </main>

        {/* Sticky primary action, mobile only */}
        {footer && (
          <div className="sticky bottom-[68px] z-20 border-t border-line bg-white px-[18px] py-4 md:hidden">
            {footer}
          </div>
        )}

        {/* Tab bar */}
        <nav
          className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white md:hidden"
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
                  "relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11.5px] font-bold",
                  active ? "text-navy" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{TAB_LABEL[item.url] ?? item.title.replace("Your ", "")}</span>
                {item.needs ? (
                  <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-price" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Desktop primary action sits in the flow, not pinned. */}
        {footer && <div className="hidden md:block" />}
      </div>
    </div>
  );
};
