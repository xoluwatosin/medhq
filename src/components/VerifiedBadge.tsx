// The verified badge, shared by the admin record and the candidate portal.
//
// Verification is earned, so it should look earned. A navy plate, the brand
// blue seal, square corners, Figtree. Nothing red, ever, because red is prices.
//
// A person can be verified while the NYSC certificate is still owed. That is a
// deliberate state, not a fudge, so it is said on the badge rather than hidden.
import { BadgeCheck } from "lucide-react";
import { art } from "@/components/mc/art";
import type { DocumentRequirement } from "@/lib/documents";

/** True when NYSC is asked of this person and we do not hold an accepted copy. */
export const nyscOutstanding = (reqs: DocumentRequirement[]) =>
  reqs.some((r) => r.doc_type === "NYSC" && r.required && r.status !== "accepted");

interface Props {
  /** Derived verification state from the record. */
  state: string;
  /** Requirements, used only to say whether NYSC is still owed. */
  reqs?: DocumentRequirement[];
  size?: "sm" | "lg";
  /** Navy surfaces flip the plate to a light seal. */
  onNavy?: boolean;
  className?: string;
}

const VerifiedBadge = ({ state, reqs = [], size = "sm", onNavy = false, className = "" }: Props) => {
  if (state !== "verified") return null;
  const pending = nyscOutstanding(reqs);

  if (size === "lg") {
    return (
      <div
        className={`inline-flex items-center gap-3 border px-4 py-3 ${
          onNavy
            ? "border-hairline-navy bg-white/10 text-white"
            : "border-brand/25 bg-tint text-navy"
        } ${className}`}
      >
        <img src={art.objShieldCheck} alt="" className="h-12 w-12 shrink-0 object-contain" />
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-tight">
            Verified by Medic Connect
          </span>
          <span
            className={`mt-0.5 block text-[13px] leading-snug ${
              onNavy ? "text-body-navy" : "text-body"
            }`}
          >
            {pending
              ? "Checks passed. NYSC certificate still outstanding."
              : "Every document we require has been checked and accepted."}
          </span>
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] ${
        onNavy
          ? "border-outline-navy bg-white/10 text-white"
          : "border-brand/30 bg-tint text-brand"
      } ${className}`}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      {pending ? "Verified, NYSC owed" : "Verified"}
    </span>
  );
};

export default VerifiedBadge;
