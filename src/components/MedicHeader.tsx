import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Phone, MessageCircle, HeartHandshake } from "lucide-react";
import CareRequestDialog from "@/components/CareRequestDialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
// Always the real lockup, never the mark beside retyped text.
import lockup from "@/assets/brand/medicconnect-logo.svg";
import lockupWhite from "@/assets/brand/medicconnect-logo-white.svg";


const MedicHeader = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  // The mobile request-care dialog lives outside the Sheet: closing the drawer
  // unmounts its contents, which would take the dialog down with it.
  const [mobileRequestOpen, setMobileRequestOpen] = useState(false);
  const { pathname } = useLocation();
  const isActive = (href: string) => pathname === href;

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Care at Home", href: "/care-at-home" },
    { name: "For Facilities", href: "/for-facilities" },
    { name: "Join Network", href: "/join" },
  ];

  const drawerLinks = [...navLinks, { name: "Creator Programme", href: "/creator" }];

  return (
    <header
      className="navy-safe-top sticky top-0 z-50 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:py-[26px]"
    >
      <div className="relative z-10 max-w-[1440px] mx-auto px-[22px] sm:px-[50px]">
        {/* Desktop: two pills of equal height, links centred, CTA pinned right. */}
        <div className="hidden xl:flex items-stretch gap-[14px]">
          <Link to="/" className="pill-nav shrink-0 h-[62px] px-[24px] flex items-center">
            <img src={lockup} alt="Medic Connect" className="w-[112px]" />
          </Link>

          <div className="pill-nav min-w-0 flex-1 h-[62px] flex items-center gap-2 pl-[10px] pr-[10px]">
            <nav className="min-w-0 flex-1 flex items-center justify-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`whitespace-nowrap text-[15px] font-semibold ${isActive(link.href) ? "text-ink" : "text-body"} hover:text-brand rounded-full px-3.5 py-2 transition-colors duration-200`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <a
              href="https://wa.me/2348126988237"
              className="shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-hairline px-[18px] py-[9px] text-[15px] font-semibold text-ink transition-colors duration-200 hover:border-brand hover:text-brand"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>

            <CareRequestDialog
              source="header"
              trigger={
                <button className="shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand px-[24px] py-[11px] text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-brand-soft">
                  <HeartHandshake className="w-4 h-4" />
                  Request care
                </button>
              }
            />
          </div>
        </div>


        {/* Mobile: one pill, lockup and a round menu button. */}
        <div className="xl:hidden pill-nav flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center">
            <img src={lockup} alt="Medic Connect" className="w-[98px]" />
          </Link>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="w-10 h-10 rounded-full bg-tint flex items-center justify-center text-ink transition-colors duration-200" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[310px] p-0 flex flex-col bg-navy border-0 text-white">

              <SheetHeader className="p-6 border-b border-hairline-navy shrink-0">
                <SheetTitle className="flex items-center">
                  <img src={lockupWhite} alt="Medic Connect" className="w-[108px]" />
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Navigation menu for Medic Connect
                </SheetDescription>
              </SheetHeader>

              <nav className="flex flex-col p-4 flex-1 overflow-y-auto overscroll-contain">
                {/* Creator Programme is off the desktop pill for room, so the drawer carries it. */}
                {drawerLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setSheetOpen(false)}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`text-[17px] font-semibold ${isActive(link.href) ? "text-white" : "text-white/75"} px-4 py-3 transition-colors duration-200`}
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              {/* The assessment fee and WhatsApp are pinned to the bottom of the drawer. */}
              <div className="shrink-0 border-t border-hairline-navy p-4 space-y-3">
                <p className="text-[13px] text-muted-navy px-1">
                  Every care plan starts with a ₦35,000 home care needs assessment.
                </p>
                <button
                  onClick={() => { setSheetOpen(false); setMobileRequestOpen(true); }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand px-6 py-3 text-[15px] font-semibold text-white transition-colors duration-200"
                >
                  <HeartHandshake className="w-4 h-4" />
                  Request care
                </button>
                <a
                  href="https://wa.me/2348126988237"
                  className="w-full inline-flex items-center justify-center gap-2 bg-white px-6 py-3 text-[15px] font-semibold text-navy transition-colors duration-200"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp us
                </a>
                <a
                  href="tel:+2348126988237"
                  className="w-full inline-flex items-center justify-center gap-2 border-[1.5px] border-outline-navy px-6 py-3 text-[15px] font-semibold text-white transition-colors duration-200"
                >
                  <Phone className="w-4 h-4" />
                  Call us
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>

      <CareRequestDialog
        source="header_mobile"
        open={mobileRequestOpen}
        onOpenChange={setMobileRequestOpen}
      />
    </header>
  );
};

export default MedicHeader;
