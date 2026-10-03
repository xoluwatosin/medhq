import { MessageCircle, Phone, HeartHandshake } from "lucide-react";
import { useLocation } from "react-router-dom";
import CareRequestDialog from "@/components/CareRequestDialog";
import { ROUTE_LINES } from "@/components/request/care-kinds";

interface CTASectionProps {
  headline: string;
  body: string;
  primaryButton?: {
    text: string;
    href: string;
  };
  secondaryButton?: {
    text: string;
    href: string;
  };
  /** Override the service line the request form opens on. */
  serviceLine?: string;
  /** Hide the request form, for pages where it makes no sense. */
  hideRequestCare?: boolean;
}

const CTASection = ({
  headline,
  body,
  primaryButton = { text: "WhatsApp us", href: "https://wa.me/2348126988237" },
  secondaryButton = { text: "Call +234 812 698 8237", href: "tel:+2348126988237" },
  serviceLine,
  hideRequestCare = false,
}: CTASectionProps) => {
  const { pathname } = useLocation();
  const lineKey = serviceLine ?? ROUTE_LINES[pathname];

  return (
    <section className="kit-curve-lg mt-16 bg-navy p-9 text-center sm:mt-20 sm:p-14">
      <div className="mx-auto max-w-[640px]">
        <h2 className="text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-white sm:text-[40px]">
          {headline}
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.65] text-body-navy sm:text-[19px]">
          {body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {!hideRequestCare && (
            <CareRequestDialog
              serviceLineKey={lineKey}
              source={`cta${lineKey ? `:${lineKey}` : ""}`}
              trigger={
                <button className="kit-curve-sm inline-flex items-center gap-2 bg-white px-7 py-3.5 text-[16px] font-semibold text-navy transition-opacity duration-200 hover:opacity-90">
                  <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                  Request care
                </button>
              }
            />
          )}
          <a
            href={primaryButton.href}
            className={`kit-curve-sm inline-flex items-center gap-2 px-7 py-3.5 text-[16px] font-semibold transition-colors duration-200 ${
              hideRequestCare
                ? "bg-white text-navy hover:opacity-90"
                : "border-[1.5px] border-outline-navy text-white hover:bg-hairline-navy"
            }`}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {primaryButton.text}
          </a>
          <a
            href={secondaryButton.href}
            className="kit-curve-sm inline-flex items-center gap-2 border-[1.5px] border-outline-navy px-7 py-3.5 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-hairline-navy"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            {secondaryButton.text}
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
