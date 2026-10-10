// One confirmation for every irreversible admin action: merges, deletes,
// sends, cancellations. Wraps any trigger; the action runs only after the
// admin confirms. An optional reason box feeds the action a note.
import { ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ConfirmActionProps {
  /** The button or menu item that opens the confirmation. Omit when controlled from outside. */
  trigger?: ReactNode;
  /** Controlled open state, for triggers that unmount when pressed, such as menu items. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  /** What will happen, in plain words, and what cannot be undone. */
  description: ReactNode;
  /** Label on the confirming button, for example "Merge profiles". */
  confirmLabel: string;
  /** Red confirming button for destructive actions. */
  destructive?: boolean;
  /** Ask for a short reason; the action receives it. */
  reason?: { label: string; placeholder?: string; required?: boolean };
  onConfirm: (reason?: string) => void | Promise<void>;
  disabled?: boolean;
}

export const ConfirmAction = ({ trigger, open: openProp, onOpenChange, title, description, confirmLabel, destructive, reason, onConfirm, disabled }: ConfirmActionProps) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const blocked = running || (reason?.required && !note.trim());

  const run = async () => {
    setRunning(true);
    try {
      await onConfirm(reason ? note.trim() || undefined : undefined);
      setOpen(false);
      setNote("");
    } finally {
      setRunning(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !running && setOpen(o)}>
      {trigger && (
        <AlertDialogTrigger asChild disabled={disabled}>
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {reason && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason" className="text-sm">
              {reason.label}
              {!reason.required && <span className="text-muted-foreground"> (optional)</span>}
            </Label>
            <Textarea id="confirm-reason" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason.placeholder} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
            className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmAction;
