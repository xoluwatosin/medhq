import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import lockupWhite from "@/assets/brand/medicconnect-logo-white.svg";

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

const Footer = () => {
  return (
    <footer className="bg-navy text-body-navy mt-8">
      <div className="max-w-[1440px] mx-auto px-[22px] sm:px-[50px] py-12">
        {/* Three doors, matching the homepage entry points */}
        <div className="grid gap-3 sm:grid-cols-3 mb-10">
          {[
            { label: "Care at home", href: "/care-at-home", note: "Families" },
            { label: "For facilities", href: "/for-facilities", note: "Hospitals and clinics" },
            { label: "Join the network", href: "/join", note: "Professionals" },
          ].map((door) => (
            <Link
              key={door.href}
              to={door.href}
              className="kit-curve border border-hairline-navy px-5 py-4 transition-colors duration-200 hover:bg-hairline-navy"
            >
              <span className="label-caps !text-muted-navy block">{door.note}</span>
              <span className="mt-1 block text-[17px] font-semibold text-white">{door.label}</span>
            </Link>
          ))}
        </div>

        {/* Full footer for desktop - reference layout */}
        <div className="hidden md:grid grid-cols-12 gap-8 mb-8">

          {/* Brand column */}
          <div className="col-span-4">
            <Link to="/" className="inline-flex items-center mb-5">
              <img src={lockupWhite} alt="Medic Connect" className="w-[168px]" />
            </Link>
            <p className="text-[15px] font-semibold text-white mb-2">The Care Operating System</p>
            <p className="text-[15px] leading-relaxed mb-6">
              Professional healthcare staffing and compassionate care services across Nigeria and beyond. HEFAMAA Accredited.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-4">
              <a href="https://www.facebook.com/p/Medic-Connect-61571413054782/" target="_blank" rel="noopener noreferrer" className="text-muted-navy hover:text-white transition-colors duration-200" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/medicconnecthq" target="_blank" rel="noopener noreferrer" className="text-muted-navy hover:text-white transition-colors duration-200" aria-label="Instagram">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>
              </a>
              <a href="https://x.com/MedicConnectHQ" target="_blank" rel="noopener noreferrer" className="text-muted-navy hover:text-white transition-colors duration-200" aria-label="X">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://ng.linkedin.com/company/medicconnect-co" target="_blank" rel="noopener noreferrer" className="text-muted-navy hover:text-white transition-colors duration-200" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="https://wa.me/2348126988237" target="_blank" rel="noopener noreferrer" className="text-muted-navy hover:text-white transition-colors duration-200" aria-label="WhatsApp">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading} className="col-span-2">
              <h3 className="label-caps !text-muted-navy mb-4 pb-2 border-b border-hairline-navy">{column.heading}</h3>
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

        {/* Desktop bottom bar */}
        <div className="hidden md:flex pt-8 border-t border-hairline-navy flex-col md:flex-row justify-between items-center gap-4 text-[13px] text-muted-navy">
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
