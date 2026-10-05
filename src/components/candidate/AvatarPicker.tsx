import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AVATARS } from "./avatars";

/** Choose the character on your ID card. Saved to the sign-in account. */
const AvatarPicker = ({
  open,
  onOpenChange,
  current,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current?: string | null;
  onPicked: (key: string) => void;
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  const pick = async (key: string) => {
    setSaving(key);
    const { error } = await supabase.auth.updateUser({ data: { avatar: key } });
    setSaving(null);
    if (error) {
      toast({ title: "We could not save that", description: "Please try again.", variant: "destructive" });
      return;
    }
    onPicked(key);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cx cx-portal max-h-[90dvh] max-w-[720px] overflow-y-auto !rounded-none border-2 border-navy p-6 shadow-[8px_8px_0_hsl(var(--navy))] sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-[26px] font-extrabold tracking-[-0.04em] text-navy">Choose your character</DialogTitle>
          <DialogDescription className="text-[15px] text-body">
            This is the picture on your Medic Connect ID. Only you see it here.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {AVATARS.map((a) => {
            const on = a.key === current;
            return (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={() => pick(a.key)}
                  disabled={!!saving}
                  aria-pressed={on}
                  aria-label={a.label}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-1.5 border-2 bg-tint p-2 transition-colors disabled:opacity-60",
                    on ? "border-navy shadow-[4px_4px_0_hsl(var(--brand))]" : "border-transparent hover:border-navy/40",
                  )}
                >
                  <span className="flex h-[110px] w-full items-end justify-center overflow-hidden">
                    <img src={a.src} alt="" loading="lazy" className="h-full object-contain object-bottom" />
                  </span>
                  <span className="flex min-h-[2.5em] items-center text-[12px] font-bold leading-tight text-navy">{a.label}</span>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center bg-brand text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarPicker;
