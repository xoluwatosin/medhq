// The candidate shell.
//
// Desktop: a 244px navy rail, one white pill for the active page, a red count
// badge only where something needs doing. Mobile: a navy header with a back
// chevron and at most one right hand action, a four item tab bar at the
// bottom, and the primary action in a sticky footer rather than in the flow.
import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AvatarPicker from "./AvatarPicker";
import { avatarFor } from "./avatars";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, FileText, CalendarDays, CalendarCheck, Sliders, Briefcase, ClipboardList, User, ChevronLeft, LogOut, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import markSoft from "@/assets/brand/m-o-soft.svg";
import { art as clipArt } from "@/components/mc/art";
import { Watermark } from "@/components/mc/brand";

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

/** The object beside each page title on desktop. */
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
  back,
  headerAction,
  footer,
  nav = cxNav,
  profile,
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
  /** Who is signed in, shown as an ID card at the top of the sidebar. */
  profile?: { name: string; role?: string; art?: string; verified?: boolean };
  children: ReactNode;
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tabs = nav.filter((i) => MOBILE_TABS.includes(i.url));
  const { user } = useAuth();
  // The account holds the choice; a fresh pick shows at once, before the session refreshes.
  const [picked, setAvatar] = useState<string | null>(null);
  const avatar = picked ?? (user?.user_metadata as { avatar?: string } | undefined)?.avatar ?? null;
  const [picking, setPicking] = useState(false);
  const idArt = avatarFor(avatar) ?? profile?.art ?? clipArt.charNurse;
  const pageArt = PAGE_ART[Object.keys(PAGE_ART).find((u) => u === pathname || (u !== "/portal" && pathname.startsWith(u))) ?? ""];

  const signOut = () => supabase.auth.signOut().then(() => navigate("/portal/login"));

  return (
    <div className="cx cx-portal flex min-h-dvh w-full bg-navy md:bg-white">
      {/* Desktop rail */}
      <aside className="relative hidden w-[260px] shrink-0 flex-col overflow-hidden bg-navy px-4 py-7 md:flex">
        <Watermark glyph="inf" size={420} opacity={0.12} className="-bottom-[120px] -left-[150px]" />
        <div className="relative z-10 flex h-full flex-col">
          <Link to="/" className="mb-7 ml-2 block">
            <img src={logoWhite} alt="Medic Connect" className="w-[132px]" />
          </Link>
          {profile && (
            <div className="mb-7 bg-white shadow-[5px_5px_0_hsl(var(--brand))]">
              <span className="flex items-center justify-between bg-brand px-3 py-1.5">
                <span className="text-[10px] font-extrabold tracking-[0.16em] text-white">MEDIC CONNECT</span>
                <span className="text-[10px] font-bold tracking-[0.1em] text-white/80">CANDIDATE</span>
              </span>
              <span className="flex items-end gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  aria-label="Change your ID character"
                  title="Change your character"
                  className="group relative flex h-[68px] w-[56px] shrink-0 items-end justify-center overflow-hidden bg-tint"
                >
                  <img src={idArt} alt="" className="h-full w-full object-cover object-top" />
                  <span className="absolute inset-x-0 bottom-0 bg-navy/85 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-[0.1em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Change
                  </span>
                </button>
                <Link to="/portal/details" className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[16px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{profile.name}</span>
                  {profile.role && <span className="truncate text-[12.5px] text-body">{profile.role}</span>}
                  {profile.verified ? (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand">
                      <img src={clipArt.objShieldCheck} alt="" className="h-4 w-4 object-contain" />
                      Verified
                    </span>
                  ) : (
                    <span className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Profile in progress</span>
                  )}
                </Link>
              </span>
            </div>
          )}
          <AvatarPicker open={picking} onOpenChange={setPicking} current={avatar} onPicked={setAvatar} />
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = isActive(pathname, item.url);
              return (
                <Link
                  key={item.url}
                  to={item.url}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 px-3 text-[14.5px] transition-colors",
                    active
                      ? "bg-white font-extrabold text-navy shadow-[4px_4px_0_hsl(var(--brand))]"
                      : "font-bold text-body-navy hover:bg-white/10 hover:text-white",
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
            className="mt-6 flex min-h-11 items-center gap-2.5 border-t border-hairline-navy px-3 pt-6 text-[14.5px] font-bold text-body-navy transition-colors hover:bg-white/10 hover:text-white"
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
          <h1 className="flex-1 truncate text-center text-[17px] font-extrabold tracking-[-0.03em] !text-white md:hidden">
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

        <main className="min-w-0 flex-1 bg-white px-[18px] py-6 md:px-12 md:py-12">
          <div className="mx-auto flex w-full max-w-[900px] flex-col gap-[26px]">
            <div className="hidden items-end justify-between gap-6 md:flex">
              <div>
                {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
                <h1 className="text-[40px] leading-[1.02] tracking-[-0.05em] text-navy">{title}</h1>
              </div>
              {pageArt && <img src={pageArt} alt="" className="-mb-2 h-[92px] w-[92px] shrink-0 rotate-[-6deg] object-contain" />}
            </div>
            {children}
          </div>
        </main>

        {/* Sticky primary action, mobile only */}
        {footer && (
          <div className="sticky bottom-[62px] z-20 border-t-2 border-navy/10 bg-white px-[18px] py-4 md:hidden">
            {footer}
          </div>
        )}

        {/* Tab bar */}
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
                {item.needs ? (
                  <span className="absolute right-[22%] top-2 h-2 w-2 bg-price" />
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
