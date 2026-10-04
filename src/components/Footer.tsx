import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import lockupWhite from "@/assets/brand/medicconnect-logo-white.svg";
import { NotchTag } from "@/components/mc/brand";
import { art } from "@/components/mc/art";

type FooterLink = { label: string; href: string; external?: boolean };
type FooterColumn = { heading: string; links: FooterLink[] };

const footerColumns: FooterColumn[] = [
  {
    heading: "Services",
    links: [
      { label: "Care at Home", href: "/care-at-home" },
      { label: "Clinical Home Care", href: "/clinical-home-care" },
      { label: "Antenatal Care", href: "/antenatal-care" },
      { label: "Postnatal Care", href: "/postnatal-care" },
      { label: "Nanny & Childcare", href: "/nanny-childcare" },
      { label: "Eldercare", href: "/eldercare" },
      { label: "Pediatric Care", href: "/pediatric-care" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Join Our Network", href: "/join" },
    ],
  },
  {
    heading: "Programs",
    links: [
      { label: "Hospital Staffing", href: "/hospital-staffing" },
      { label: "Hospital Support", href: "/hospital-support" },
      { label: "Clinical Research", href: "/clinical-research" },
      { label: "Medic Connect Global", href: "https://www.medicconnect.org", external: true },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Get a Quote", href: "/contact" },
      { label: "Careers", href: "/join" },
      { label: "WhatsApp Support", href: "https://wa.me/2348126988237", external: true },
    ],
  },
];

// The footer carries no ticker band or door cards: the menu and the link columns cover those pages.
const Footer = () => {
  return (
    <footer className="relative mt-8 overflow-hidden bg-navy text-body-navy">
      <div className="relative max-w-[1440px] mx-auto px-[22px] sm:px-[50px] pt-6 pb-12 md:pt-14">

        {/* Full footer for desktop - reference layout */}
        <div className="hidden md:grid grid-cols-12 gap-8 mb-8">

          {/* Brand column */}
          <div className="col-span-4">
            <Link to="/" className="inline-flex items-center mb-5">
              <img src={lockupWhite} alt="Medic Connect" className="w-[168px]" />
            </Link>
            <NotchTag tone="blue" size="sm" className="mb-3">The care operating system</NotchTag>
            <p className="text-[15px] leading-relaxed mb-6">
              Professional healthcare staffing and compassionate care services across Nigeria and beyond. HEFAMAA Accredited.
            </p>
            {/* Social platforms as boxed text links, not marks. */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Instagram", href: "https://www.instagram.com/medicconnecthq" },
                { label: "LinkedIn", href: "https://ng.linkedin.com/company/medicconnect-co" },
                { label: "X", href: "https://x.com/MedicConnectHQ" },
                { label: "Facebook", href: "https://www.facebook.com/p/Medic-Connect-61571413054782/" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-[1.5px] border-outline-navy px-3 py-1.5 text-[13px] font-extrabold text-white transition-colors duration-200 hover:bg-white hover:text-navy"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading} className="col-span-2">
              <h3 className="label-caps !text-muted-navy mb-4 pb-2 border-b-2 border-brand">{column.heading}</h3>
              <ul className="space-y-2 text-[15px]">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors duration-200">
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.href} className="hover:text-white transition-colors duration-200">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mobile: the same columns, collapsible */}
        <div className="md:hidden mb-8">
          <Accordion type="single" collapsible className="border-t border-hairline-navy">
            {footerColumns.map((column) => (
              <AccordionItem key={column.heading} value={column.heading} className="border-b border-hairline-navy">
                <AccordionTrigger className="min-h-[44px] py-3 text-[15px] font-semibold text-white hover:no-underline">
                  {column.heading}
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <ul className="text-[15px] text-body-navy">
                    {column.links.map((link) => (
                      <li key={`m-${column.heading}-${link.label}`}>
                        {link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-[44px] items-center hover:text-white transition-colors duration-200"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            to={link.href}
                            className="flex min-h-[44px] items-center hover:text-white transition-colors duration-200"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="flex flex-wrap gap-x-6 text-[15px] text-body-navy">
            <Link to="/privacy" className="flex min-h-[44px] items-center hover:text-white transition-colors duration-200">
              Global Privacy Policy
            </Link>
            <Link to="/terms" className="flex min-h-[44px] items-center hover:text-white transition-colors duration-200">
              Terms of Service
            </Link>
          </div>
        </div>

        {/* The people, standing on the bottom edge of the band. */}
        <div aria-hidden="true" className="pointer-events-none hidden lg:flex absolute right-[50px] bottom-0 items-end gap-1">
          <img src={art.charNurse} alt="" className="h-[150px]" />
          <img src={art.charCaregiver} alt="" className="h-[146px]" />
          <img src={art.charBoy} alt="" className="h-[100px]" />
          <img src={art.charDoctor} alt="" className="h-[156px]" />
        </div>

        {/* Desktop bottom bar */}
        <div className="hidden md:flex lg:pr-[420px] pt-8 border-t border-hairline-navy flex-col md:flex-row justify-between items-center gap-4 text-[13px] text-muted-navy">
          <p>© 2026 Medic Connect. All rights reserved. RC 15986218 (England & Wales) | RC 8026476 (Nigeria)</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors duration-200">Global Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors duration-200">Terms of Service</Link>
          </div>
        </div>

        {/* Mobile minimal footer */}
        <div className="md:hidden text-center text-[13px] text-muted-navy space-y-3">
          <p>© 2026 Medic Connect. All rights reserved.</p>
          <p>RC 15986218 (England & Wales) | RC 8026476 (Nigeria)</p>
          <p className="flex items-center justify-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            145 Igbosere Road, Lagos Island, Nigeria
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
