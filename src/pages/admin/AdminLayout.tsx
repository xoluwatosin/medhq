import { Outlet, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, ArrowLeft, Menu, Search, UserCog, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import logoMark from "@/assets/brand/m-full-soft.svg";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  visibleDomains, myProfileDomain, domainLanding, domainDestinations, locateRoute,
  isNavItemActive, type AdminDomain,
} from "@/lib/admin-nav";

/** The rail head: full lockup when open, the mark alone when retracted. */
const RailHead = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className={`flex shrink-0 items-center ${collapsed ? "justify-center px-0 pb-3 pt-4" : "px-4 pb-4 pt-5"}`}>
      {collapsed ? (
        <img src={logoMark} alt="Medic Connect" className="h-7 w-7" />
      ) : (
        <div>
          <img src={logoWhite} alt="Medic Connect" className="h-6 w-auto" />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Admin Centre</p>
        </div>
      )}
    </div>
  );
};

/** Retract control, pinned to the foot of the rail. */
const RailFoot = () => {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="shrink-0 p-2">
      <button
        onClick={toggleSidebar}
        aria-label={collapsed ? "Widen the menu" : "Narrow the menu"}
        className={`flex min-h-10 w-full items-center gap-2.5 px-3 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white ${collapsed ? "justify-center px-0" : ""}`}
      >
        {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" />Narrow the menu</>}
      </button>
    </div>
  );
};

const AdminLayout = () => {
  const { forceSignOut, isSuperAdmin, permissions, adminDisplayName, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Two-level phone navigator: which domain is drilled into, null = the domain index.
  const [mobileDomain, setMobileDomain] = useState<string | null>(null);

  // Staff who hold nothing but "own profile only" get a single door: their own
  // record. Every other admin path bounces back to it.
  const profileOnly = !isSuperAdmin && permissions.includes("profile_only");

  const domains: AdminDomain[] = useMemo(
    () => (profileOnly ? [myProfileDomain] : visibleDomains({ isSuperAdmin, permissions })),
    [isSuperAdmin, permissions, profileOnly],
  );

  // Where we are: the domain, then the destination inside it.
  const here = useMemo(() => locateRoute(domains, location.pathname), [domains, location.pathname]);

  // The domain's own navigation. It only earns a row when the domain holds more
  // than one destination; specialist pages stay out of it.
  const localNav = here.domain && here.domain.items.length > 1 ? here.domain.items : [];

  // Command palette: the fastest route between thirty-odd pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close the phone navigator whenever the route changes underneath it.
  useEffect(() => {
    setMobileOpen(false);
    setMobileDomain(null);
  }, [location.pathname]);

  // Lock body scroll while the full-screen navigator is up.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  const initials = (adminDisplayName || user?.email || "A")
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  /**
   * The phone navigator: a full-viewport, two-level surface. Level one is the
   * business domains; drilling in shows that domain's destinations. Never the
   * whole site map at once.
   */
  const openMobileDomain = domains.find((d) => d.key === mobileDomain) ?? null;

  const MobileNav = () => (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-navy text-white md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Admin navigation"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15 px-3">
        {openMobileDomain ? (
          <button
            type="button"
            onClick={() => setMobileDomain(null)}
            className="flex min-h-11 items-center gap-1.5 pr-2 text-[15px] font-medium text-white/80"
          >
            <ChevronLeft className="h-5 w-5" />
            All sections
          </button>
        ) : (
          <div className="flex items-center gap-3 px-1">
            <img src={logoWhite} alt="Medic Connect" className="h-5 w-auto" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Admin Centre</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="ml-auto flex h-11 w-11 items-center justify-center text-white/80"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {openMobileDomain ? (
          <>
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {openMobileDomain.label}
            </p>
            <ul className="divide-y divide-white/10">
              {openMobileDomain.items.map((item) => {
                const active = isNavItemActive(location.pathname, item.url, item.exact);
                return (
                  <li key={item.url}>
                    <Link
                      to={item.url}
                      className={`flex min-h-[52px] items-center gap-3 px-2 py-3 text-[16px] ${
                        active ? "font-semibold text-white" : "text-white/80"
                      }`}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0 text-white/60" />
                      <span className="flex-1">{item.title}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="Current page" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <ul className="divide-y divide-white/10">
            {domains.map((domain) => {
              const active = here.domain?.key === domain.key;
              return (
                <li key={domain.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (domain.items.length <= 1) navigate(domainLanding(domain));
                      else setMobileDomain(domain.key);
                    }}
                    className="flex min-h-[56px] w-full items-center gap-3 px-2 py-3 text-left"
                  >
                    <domain.icon className="h-[18px] w-[18px] shrink-0 text-white/60" />
                    <span
                      className={`min-w-0 flex-1 text-[16px] ${active ? "font-semibold text-white" : "font-medium text-white/85"}`}
                    >
                      {domain.label}
                    </span>
                    {domain.items.length > 1 && <ChevronRight className="h-5 w-5 shrink-0 text-white/40" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div
        className="shrink-0 space-y-1 border-t border-white/15 bg-navy px-3 pt-2"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <Button variant="ghost" size="sm" className="min-h-11 w-full justify-start text-white/70 hover:bg-white/10 hover:text-white" asChild>
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to site</Link>
        </Button>
        <Button variant="ghost" size="sm" className="min-h-11 w-full justify-start text-white/70 hover:bg-white/10 hover:text-white" onClick={forceSignOut}>
          <LogOut className="mr-2 h-4 w-4" />Sign out
        </Button>
      </div>
    </div>
  );

  if (profileOnly && location.pathname !== "/admin/me") {
    return <Navigate to="/admin/me" replace />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "4rem" } as React.CSSProperties}>
      <div className="admin-kit flex min-h-dvh w-full bg-muted">
        {/* Desktop command rail: the business domains, nothing else. */}
        <Sidebar collapsible="icon" className="hidden border-r border-navy/20 md:flex">
          <SidebarContent className="flex flex-col gap-0">
            <RailHead />

            <div className="mx-3 h-px shrink-0 bg-white/15" />

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
              <SidebarGroup className="px-2 py-1">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {domains.map((domain) => (
                      <SidebarMenuItem key={domain.key}>
                        <SidebarMenuButton asChild isActive={here.domain?.key === domain.key} tooltip={domain.label}>
                          <Link to={domainLanding(domain)}>
                            <domain.icon className="h-[18px] w-[18px] shrink-0" />
                            <span className="truncate">{domain.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>

            <div className="mx-3 h-px shrink-0 bg-white/15" />

            <RailFoot />
          </SidebarContent>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-hairline bg-background/95 px-3 backdrop-blur sm:px-6">
            <div className="hidden md:block"><SidebarTrigger /></div>

            {/* Phone: contextual back to the parent page when on a detail route,
                otherwise the menu button opening the full-screen navigator. */}
            {here.deeper ? (
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={`Back to ${here.item?.title ?? "Admin"}`} asChild>
                <Link to={here.backUrl}><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open admin menu" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {/* Where you are: domain, then destination, then a leaf for details. */}
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="hidden text-muted-foreground sm:inline">{here.domain?.label ?? "Admin"}</span>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:inline" />
              <span className="truncate font-semibold text-navy">{here.item?.title ?? here.domain?.label ?? "Admin Centre"}</span>
              {here.deeper && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="truncate text-muted-foreground">Details</span>
                </>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="hidden h-9 gap-2 border-hairline pl-2.5 pr-2 text-muted-foreground sm:flex"
              >
                <Search className="h-4 w-4" />
                <span className="text-sm">Jump to…</span>
                <kbd className="ml-4 rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">⌘K</kbd>
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search admin" onClick={() => setSearchOpen(true)}>
                <Search className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-navy text-[12px] font-semibold text-white hover:bg-navy/90 hover:text-white" aria-label="Account menu">
                    {initials || "A"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="space-y-0.5">
                    <p className="text-sm font-semibold">{adminDisplayName || "Admin"}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/admin/me")}>
                    <UserCog className="mr-2 h-4 w-4" />My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />Back to site
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => forceSignOut()}>
                    <LogOut className="mr-2 h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Rendered outside the blurred header: backdrop-filter would trap
              the overlay's fixed positioning. */}
          {mobileOpen && <MobileNav />}

          {/* The domain's own navigation, directly above its workspace. */}
          {localNav.length > 0 && (
            <div className="sticky top-14 z-10 border-b border-hairline bg-background/95 backdrop-blur">
              <nav
                aria-label={`${here.domain?.label} sections`}
                className="mx-auto flex w-full max-w-[1400px] gap-1 overflow-x-auto px-3 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
              >
                {localNav.map((item) => {
                  const active = isNavItemActive(location.pathname, item.url, item.exact);
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-9 shrink-0 items-center gap-1.5 px-3 text-[13.5px] font-medium transition-colors ${
                        active
                          ? "border-b-2 border-navy text-navy"
                          : "border-b-2 border-transparent text-muted-foreground hover:text-navy"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:px-8 lg:py-7">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search admin pages…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          {domains.map((domain) => (
            <CommandGroup key={domain.key} heading={domain.label}>
              {domainDestinations(domain).map((item) => (
                <CommandItem
                  key={item.url}
                  value={`${item.title} ${domain.label} ${item.keywords ?? ""}`}
                  onSelect={() => { setSearchOpen(false); navigate(item.url); }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
};

export default AdminLayout;
