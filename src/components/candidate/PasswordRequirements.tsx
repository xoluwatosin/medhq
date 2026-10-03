import { cn } from "@/lib/utils";

/**
 * Formal guidance shown when a password is rejected or judged too weak.
 */
export const PasswordRequirements = ({ className }: { className?: string }) => (
  <div className={cn("rounded-md border border-warn-line bg-warn-bg p-3 text-[14px] leading-relaxed text-warn-ink", className)}>
    <p className="font-semibold">For your protection, your password must contain:</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      <li>No fewer than eight characters</li>
      <li>Both uppercase and lowercase letters</li>
      <li>At least one numeral or symbol</li>
      <li>No common words, personal names, or sequential patterns</li>
    </ul>
    <p className="mt-2 text-[13px] text-muted-foreground">
      Passwords that have appeared in known data breaches cannot be accepted, even if they satisfy the criteria above.
    </p>
  </div>
);
