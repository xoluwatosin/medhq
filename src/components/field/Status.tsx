// One status chip for the Care path, on the Match Universe tone vocabulary so
// a colour means the same thing in both places.
//
// Every tone carries a shape as well as a colour, and the label always says
// the state in words, so meaning never depends on colour alone. This component
// renders a state. It never decides one.
import { ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, Circle, Clock, Info, LucideIcon, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "good" | "warning" | "bad" | "info" | "progress";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-tint text-navy",
  // Amber carries everything recoverable. Red is kept for money overdue.
  warning: "bg-warn-bg text-warn-ink",
  bad: "bg-warn-bg text-warn-ink",
  info: "bg-tint text-navy",
  progress: "bg-muted text-foreground",
};

const TONE_ICON: Record<StatusTone, LucideIcon> = {
  neutral: Circle,
  good: CheckCircle2,
  warning: AlertTriangle,
  bad: XCircle,
  info: Info,
  progress: Clock,
};

export interface StatusProps {
  label: ReactNode;
  tone?: StatusTone;
  icon?: LucideIcon;
  /** Said out loud in place of the label where the label is an abbreviation. */
  srLabel?: string;
  className?: string;
}

export const Status = ({ label, tone = "neutral", icon, srLabel, className }: StatusProps) => {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium [.admin-kit_&]:rounded-none [.admin-kit_&]:px-2 [.admin-kit_&]:py-0.5 [.admin-kit_&]:font-bold",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </span>
  );
};

export default Status;
