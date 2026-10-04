import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import WhatsAppQuestionnaire from "@/components/WhatsAppQuestionnaire";

/**
 * Sticky WhatsApp bar for phones. WhatsApp is the main contact, and phone
 * visitors are the likeliest to use it, so it stays in thumb reach. It opens
 * the same short questionnaire as the floating bubble, so the enquiry still
 * lands in the admin inbox before WhatsApp opens.
 *
 * While shown it publishes its height as --mc-bottom-reserve, which floating
 * controls read to stay above it. Pages using it add matching bottom padding.
 */
const MobileWhatsAppBar = () => {
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    if (!bar) return;
    const publish = () => {
      const shown = window.getComputedStyle(bar).display !== "none";
      root.style.setProperty("--mc-bottom-reserve", shown ? `${bar.offsetHeight}px` : "0px");
      // Floating controls re-clamp their position on resize.
      window.dispatchEvent(new Event("resize"));
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    const media = window.matchMedia("(min-width: 1024px)");
    media.addEventListener("change", publish);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", publish);
      root.style.removeProperty("--mc-bottom-reserve");
    };
  }, []);

  return (
    <>
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-50 flex gap-2.5 border-t-2 border-brand bg-navy px-[22px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 lg:hidden"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-control bg-white text-[16px] font-extrabold text-navy transition-colors duration-200 active:bg-tint"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          Chat on WhatsApp
        </button>
        <a
          href="tel:+2348126988237"
          aria-label="Call +234 812 698 8237"
          className="grid h-12 w-12 place-items-center rounded-control border-[1.5px] border-outline-navy text-white transition-colors duration-200 active:bg-hairline-navy"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>
      <WhatsAppQuestionnaire open={open} onOpenChange={setOpen} />
    </>
  );
};

export default MobileWhatsAppBar;
