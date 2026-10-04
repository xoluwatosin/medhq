import { MessageCircle, Phone, HeartHandshake } from "lucide-react";
import { useLocation } from "react-router-dom";
import CareRequestDialog from "@/components/CareRequestDialog";
import { ROUTE_LINES } from "@/components/request/care-kinds";
import { Chevrons, PillSticker, Watermark } from "@/components/mc/brand";
import { personFor } from "@/components/mc/people";

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
    <section className="relative mt-20 overflow-hidden bg-navy px-6 pb-12 pt-12 shadow-offset-blue sm:mt-28 sm:px-14 sm:pb-16 sm:pt-16">
      <Watermark glyph="o" size={560} opacity={0.12} className="-left-[180px] -top-[260px]" />
      <img
        src={personFor(pathname)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="pointer-events-none absolute bottom-0 right-6 hidden h-[230px] md:block lg:right-14 lg:h-[270px]"
      />
      <div className="relative max-w-[680px] md:pr-[160px] lg:max-w-[760px] lg:pr-0">
        <div className="flex items-center gap-4">
          <Chevrons />
          <PillSticker tone="blue" tilt={-5} className="text-[13px]">
            We answer on WhatsApp
          </PillSticker>
        </div>
        <h2 className="mt-6 text-[34px] leading-[1] tracking-[-0.05em] !text-white sm:text-[48px]">{headline}</h2>
        <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.65] text-body-navy sm:text-[19px]">{body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {!hideRequestCare && (
            <CareRequestDialog
              serviceLineKey={lineKey}
              source={`cta${lineKey ? `:${lineKey}` : ""}`}
              trigger={
                <button className="kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 bg-white px-7 py-3.5 text-[16px] font-extrabold text-navy transition-colors duration-200 hover:bg-tint">
                  <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                  Request care
                </button>
              }
            />
          )}
          <a
            href={primaryButton.href}
            className={`kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 px-7 py-3.5 text-[16px] font-extrabold transition-colors duration-200 ${
              hideRequestCare
                ? "bg-white text-navy hover:bg-tint"
                : "border-[1.5px] border-outline-navy text-white hover:bg-hairline-navy"
            }`}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {primaryButton.text}
          </a>
          <a
            href={secondaryButton.href}
            className="kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 border-[1.5px] border-outline-navy px-7 py-3.5 text-[16px] font-extrabold text-white transition-colors duration-200 hover:bg-hairline-navy"
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
