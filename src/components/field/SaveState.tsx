// What the person is told about their answers being kept.
//
// Saved appears only after the server has acknowledged the change. A failure
// is visible and offers a retry, and never leaves the previous Saved standing
// in its place.
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import type { SaveStatus } from "./useAutosave";

export interface SaveStateProps {
  status: SaveStatus;
  savedAt?: Date | null;
  onRetry?: () => void;
  className?: string;
}

export const SaveState = ({ status, savedAt, onRetry, className }: SaveStateProps) => {
  const shared = "inline-flex items-center gap-1.5 text-[12px] leading-none";

  return (
    <div className={cn("min-w-0", className)}>
      <p aria-live="polite" className="sr-only">
        {status === "saving" && "Saving your answers"}
        {status === "saved" && "Your answers are saved"}
        {status === "pending" && "Your answers are not saved yet"}
        {status === "error" && "Your answers could not be saved"}
      </p>
      {status === "saving" && (
        <span className={cn(shared, "text-muted-foreground")}>
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> Saving
        </span>
      )}
      {status === "pending" && (
        <span className={cn(shared, "text-muted-foreground")}>Not saved yet</span>
      )}
      {status === "saved" && (
        <span className={cn(shared, "text-muted-foreground")}>
          <Check aria-hidden className="h-3.5 w-3.5" />
          Saved{savedAt ? ` ${formatTime(savedAt)}` : ""}
        </span>
      )}
      {status === "error" && (
        <span className={cn(shared, "flex-wrap gap-x-2 text-destructive")}>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> Not saved
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try again
            </button>
          )}
        </span>
      )}
    </div>
  );
};

export default SaveState;
