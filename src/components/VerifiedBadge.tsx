// The verified badge, shared by the admin record and the candidate portal.
//
// Verification is earned, so it should look earned. A navy plate, the brand
// blue seal, square corners, Figtree, pressed on like a rubber stamp. Nothing
// red, ever, because red is prices.
//
// A person can be verified while the NYSC certificate is still owed. That is a
// deliberate state, not a fudge, so it is said on the badge rather than hidden.
import { BadgeCheck } from "lucide-react";
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
      <div className={`inline-flex items-center gap-4 ${className}`}>
        {/* A rubber stamp, as on the carer ID: pressed on, a little crooked. */}
        <div
          className={`shrink-0 -rotate-[7deg] border-[3px] px-3 py-1.5 text-center leading-[1.1] ${
            onNavy ? "border-white text-white" : "border-brand text-brand"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-[17px] font-black tracking-[0.12em]">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            VERIFIED
          </div>
          <div className={`mt-1 border-t-2 pt-1 text-[9.5px] font-extrabold tracking-[0.16em] ${onNavy ? "border-white" : "border-brand"}`}>
            MEDIC CONNECT
          </div>
        </div>
        <span className={`min-w-0 max-w-[30ch] text-[13.5px] leading-snug ${onNavy ? "text-body-navy" : "text-body"}`}>
          {pending
            ? "Checks passed. NYSC certificate still outstanding."
            : "Every document we require has been checked and accepted."}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex -rotate-[4deg] items-center gap-1 border-2 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] ${
        onNavy ? "border-white text-white" : "border-brand text-brand"
      } ${className}`}
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {pending ? "Verified, NYSC owed" : "Verified"}
    </span>
  );
};

export default VerifiedBadge;
