import { cn } from "@/lib/utils";

/**
 * A naira sign sized and coloured like a Lucide icon, for places that take an
 * icon component. Lucide has no naira icon, and prices here are in naira, so a
 * dollar sign is wrong.
 */
const NairaIcon = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn("inline-grid place-items-center text-[20px] font-extrabold leading-none", className)}>
    ₦
  </span>
);

export default NairaIcon;
