import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, MessageCircle, ArrowLeft, ArrowRight } from "lucide-react";

interface CareQuestionnaireProps {
  trigger?: React.ReactNode;
}

const WHO_OPTIONS = [
  "An ageing parent",
  "A new mother",
  "Someone recovering at home",
  "A child",
  "A loved one, from abroad",
  "Someone else",
];

const TIMING_OPTIONS = [
  "As soon as possible",
  "Within a week",
  "Within a month",
  "Just exploring",
];

const CARE_TYPE_OPTIONS = [
  "Skilled nursing",
  "Post-surgical / recovery",
  "Antenatal or postnatal",
  "Eldercare or companionship",
  "Nanny or childcare",
  "Not sure yet",
];

const CareQuestionnaire = ({ trigger }: CareQuestionnaireProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [who, setWho] = useState("");
  const [timing, setTiming] = useState("");
  const [careType, setCareType] = useState("");
  const [location, setLocation] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setStep(0);
    setWho("");
    setTiming("");
    setCareType("");
    setLocation("");
    setName("");
    setNotes("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  };

  const sendToWhatsApp = () => {
    const lines = [
      "Hello Medic Connect, I would like to enquire about care.",
      "",
      `• Who needs care: ${who || "Not specified"}`,
      `• Type of care: ${careType || "Not specified"}`,
      `• When to start: ${timing || "Not specified"}`,
      `• Location: ${location || "Not specified"}`,
      `• My name: ${name || "Not specified"}`,
    ];
    if (notes.trim()) {
      lines.push(`• Notes: ${notes.trim()}`);
    }
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/2348126988237?text=${text}`, "_blank", "noopener,noreferrer");
    handleOpenChange(false);
  };

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canAdvance =
    (step === 0 && who !== "") ||
    (step === 1 && careType !== "") ||
    (step === 2 && timing !== "") ||
    step === 3;

  const Choice = ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: string[];
    onChange: (v: string) => void;
  }) => (
    <div className="grid gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`text-left rounded-2xl border px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-sm ${
            value === opt
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-card text-foreground/90"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="rounded-full px-6 py-5 gap-2">
            <HelpCircle className="w-4 h-4" />
            Who needs care?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Who needs care?</DialogTitle>
          <DialogDescription>
            A few quick questions. We'll send your answers straight to our care team on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <div className="flex items-center gap-1 mb-5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Who are we caring for?</p>
              <Choice value={who} options={WHO_OPTIONS} onChange={setWho} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">What kind of care do you need?</p>
              <Choice value={careType} options={CARE_TYPE_OPTIONS} onChange={setCareType} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">When would you like to start?</p>
              <Choice value={timing} options={TIMING_OPTIONS} onChange={setTiming} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cq-name">Your name</Label>
                <Input
                  id="cq-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Adaeze"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq-location">Location</Label>
                <Input
                  id="cq-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Lekki, Lagos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq-notes">Anything else? (optional)</Label>
                <Textarea
                  id="cq-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific needs, conditions, or preferred timing"
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={back}
              disabled={step === 0}
              className="rounded-full gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={next}
                disabled={!canAdvance}
                className="rounded-full gap-1"
              >
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={sendToWhatsApp}
                className="rounded-full gap-2 bg-primary hover:bg-primary/90"
              >
                <MessageCircle className="w-4 h-4" />
                Send on WhatsApp
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CareQuestionnaire;
