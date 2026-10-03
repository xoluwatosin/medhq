// The WhatsApp widget: three taps, then the chat opens with everything written.
//
// Deliberately shorter than the full Request care journey. We file the enquiry
// first so it is never lost if the chat is never sent.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Loader2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  Choice, DialCodeField, FieldLabel, Question, RequestShell, joinPhone,
} from "@/components/request/RequestShell";
import { CARE_KINDS, CareKind, WHATSAPP_NUMBER } from "@/components/request/care-kinds";
import { submitCareRequest } from "@/lib/enquiries";
import { rememberInterest, readVisitor, writeVisitor } from "@/lib/visitor";
import { trackCareRequest, trackServiceInterest } from "@/lib/measurement";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const WhatsAppQuestionnaire = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [dial, setDial] = useState("+234");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<CareKind | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const v = readVisitor();
    setName(v.name);
    setDial(v.dial || "+234");
    setPhone(v.phone);
  }, [open]);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(() => { setStep(0); setKind(null); }, 250);
  };

  const fullPhone = joinPhone(dial, phone);

  const message = () => [
    "Hello Medic Connect, I would like to talk about care.",
    "",
    `Name: ${name.trim()}`,
    `WhatsApp: ${fullPhone}`,
    `Care needed: ${kind?.label ?? "Not sure yet"}`,
  ].join("\n");

  const send = async () => {
    if (!kind || sending) return;
    setSending(true);
    try {
      await submitCareRequest({
        name,
        email: "",
        phone: fullPhone,
        city: "",
        serviceLineKey: kind.line,
        serviceLineName: kind.label,
        message: `Started a WhatsApp chat about ${kind.label.toLowerCase()}.`,
        answers: { kind_of_care: kind.label, channel: "WhatsApp widget" },
        consentEmail: false,
        source: "whatsapp_widget",
      });
      trackCareRequest(kind.line);
      trackServiceInterest(kind.line, "whatsapp_widget");
      rememberInterest(kind.line);
      writeVisitor({ name: name.trim(), dial, phone: phone.trim() });
    } catch {
      // The chat matters more than the record; carry on either way.
    } finally {
      setSending(false);
    }
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message())}`, "_blank", "noopener,noreferrer");
    toast({ title: "Opening WhatsApp", description: "Your details are already written out for you." });
    close(false);
  };

  const canContinue = step === 0 ? name.trim().length > 1 : step === 1 ? phone.trim().length > 5 : !!kind;

  return (
    <RequestShell
      open={open}
      onOpenChange={close}
      eyebrow="Chat on WhatsApp"
      title="Start a WhatsApp chat"
      step={step}
      total={3}
      chip={kind?.label ?? null}
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" className="rounded-xl text-body" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : <span />}
          {step < 2 ? (
            <Button className="min-w-[136px] rounded-xl" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button className="min-w-[150px] rounded-xl" disabled={!canContinue || sending} onClick={send}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Open WhatsApp
            </Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <Question heading="What is your name?" help="So we know who we are speaking with." stepKey="name">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="wa-name">Your name, required</FieldLabel>
            <Input id="wa-name" value={name} maxLength={100} autoFocus
              className="h-12 rounded-xl border-hairline-warm bg-background px-4 text-[16px]"
              placeholder="e.g. Adaeze Okonkwo"
              onChange={(e) => setName(e.target.value)} />
          </div>
        </Question>
      )}

      {step === 1 && (
        <Question heading="What is your WhatsApp number?" help="In case the chat drops, we can call you back." stepKey="phone">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="wa-phone">WhatsApp number, required</FieldLabel>
            <DialCodeField id="wa-phone" dial={dial} phone={phone} onDial={setDial} onPhone={setPhone} autoFocus />
          </div>
        </Question>
      )}

      {step === 2 && (
        <Question heading="What kind of care?" help="Choose the closest one. We can sort out the detail in the chat." stepKey="kind">
          <div className="grid gap-2">
            {CARE_KINDS.map((k) => (
              <Choice key={k.line} label={k.label} selected={kind?.line === k.line} onClick={() => setKind(k)} />
            ))}
          </div>
        </Question>
      )}
    </RequestShell>
  );
};

export default WhatsAppQuestionnaire;
