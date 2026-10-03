// The accessibility options a family can set for themselves.
import { useEffect, useRef, useState } from "react";
import { Accessibility, Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import DraggableControl from "../ui/DraggableControl";

const STORAGE_KEY = "mc_accessibility";

interface Settings {
  textStep: 0 | 1 | 2 | 3;
  contrast: boolean;
  stillness: boolean;
  readableFont: boolean;
  underline: boolean;
}

const DEFAULTS: Settings = {
  textStep: 0,
  contrast: false,
  stillness: false,
  readableFont: false,
  underline: false,
};

const read = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
};

const ROOT_CLASSES = [
  "a11y-text-1", "a11y-text-2", "a11y-text-3", "a11y-contrast",
  "a11y-still", "a11y-readable", "a11y-underline",
] as const;

const apply = (s: Settings, enabled = true) => {
  const root = document.documentElement;
  ROOT_CLASSES.forEach((name) => root.classList.remove(name));
  if (!enabled) return;
  root.classList.toggle("a11y-text-1", s.textStep === 1);
  root.classList.toggle("a11y-text-2", s.textStep === 2);
  root.classList.toggle("a11y-text-3", s.textStep === 3);
  root.classList.toggle("a11y-contrast", s.contrast);
  root.classList.toggle("a11y-still", s.stillness);
  root.classList.toggle("a11y-readable", s.readableFont);
  root.classList.toggle("a11y-underline", s.underline);
};

const Row = ({
  label, help, checked, onChange,
}: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-hairline-warm py-3.5 first:border-t-0">
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold leading-snug text-ink">{label}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-body">{help}</span>
    </span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </label>
);

export const AccessibilityPanel = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [speaking, setSpeaking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const hidden = pathname.startsWith("/admin") || pathname.startsWith("/portal");

  useEffect(() => {
    const held = read();
    setSettings(held);
    apply(held, !hidden);
    return () => apply(DEFAULTS, false);
  }, [hidden]);

  const set = (next: Partial<Settings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    apply(merged, !hidden);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  };

  const reset = () => {
    setSettings(DEFAULTS);
    apply(DEFAULTS, !hidden);
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("medic:reset-controls"));
  };

  const readAloud = () => {
    const speech = window.speechSynthesis;
    if (!speech) return;
    if (speaking) {
      speech.cancel();
      setSpeaking(false);
      return;
    }
    const target = document.querySelector("[data-read-aloud]");
    const text = (target?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1200));
    utterance.lang = "en-GB";
    utterance.onend = () => setSpeaking(false);
    speech.cancel();
    speech.speak(utterance);
    setSpeaking(true);
  };

  const textLabel = ["Normal", "Larger", "Larger still", "Largest"][settings.textStep];

  if (hidden) return null;

  return (
    <>
      <DraggableControl storageKey="mc_a11y_btn_pos" defaultCorner="bottom-left">
        <Button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Accessibility options"
          className="h-12 w-12 rounded-full bg-brand p-0 shadow-[var(--shadow-dialog)] hover:bg-brand/90"
        >
          <Accessibility className="h-6 w-6" aria-hidden />
        </Button>
      </DraggableControl>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          className="a11y-panel max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[440px] overflow-y-auto p-5 sm:p-6 [&>button]:h-11 [&>button]:w-11"
        >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="label-caps text-[9px] text-label">Accessibility</p>
                <DialogTitle className="mt-1 text-[19px] font-bold leading-tight text-navy">
                  Make this easier to use
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Change how Medic Connect pages look and move. Settings are saved on this device.
                </DialogDescription>
              </div>
            </div>

            <div className="border-t border-hairline-warm py-3.5">
              <p className="text-[15px] font-semibold text-ink">Text size</p>
              <p className="mt-0.5 text-[13px] text-body">Currently {textLabel.toLowerCase()}.</p>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((stepValue) => (
                  <Button
                    key={stepValue}
                    type="button"
                    variant="outline"
                    onClick={() => set({ textStep: stepValue as Settings["textStep"] })}
                    aria-pressed={settings.textStep === stepValue}
                    className={cn(
                      "h-11 rounded-xl border text-[14px] font-semibold transition-colors",
                      settings.textStep === stepValue
                        ? "border-brand bg-tint text-navy"
                        : "border-hairline-warm bg-background text-body",
                    )}
                  >
                    {["A", "A+", "A++", "A+++"][stepValue]}
                  </Button>
                ))}
              </div>
            </div>

            <Row
              label="Higher contrast"
              help="Stronger text and clearer edges."
              checked={settings.contrast}
              onChange={(v) => set({ contrast: v })}
            />
            <Row
              label="Reduce movement"
              help="Turns off the sliding and fading."
              checked={settings.stillness}
              onChange={(v) => set({ stillness: v })}
            />
            <Row
              label="Easier-to-read typeface"
              help="Wider letters, helpful with dyslexia."
              checked={settings.readableFont}
              onChange={(v) => set({ readableFont: v })}
            />
            <Row
              label="Underline links and buttons"
              help="Marks everything that can be pressed."
              checked={settings.underline}
              onChange={(v) => set({ underline: v })}
            />

            <div className="border-t border-hairline-warm pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={readAloud}
                className="h-12 w-full rounded-xl border-hairline-warm text-[15px] font-semibold"
              >
                <Volume2 className="mr-2 h-4 w-4" aria-hidden />
                {speaking ? "Stop reading" : "Read this page aloud"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={reset}
                className="mt-2 h-10 w-full text-[13px] text-muted-foreground"
              >
                Reset all accessibility options
              </Button>
              <p className="sr-only" aria-live="polite">
                {speaking ? "Reading this page aloud" : "Page reading stopped"}
              </p>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccessibilityPanel;
