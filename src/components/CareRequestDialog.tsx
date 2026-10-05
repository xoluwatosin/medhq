// Request care, from anywhere on the site.
//
// A gentle tap-through journey: how to reach you, who the care is for, what
// kind of care, and how soon. Choices advance on their own; the answer to
// "who" shapes the list of care kinds, and the kind maps to a service line on
// the enquiry desk.
//
// Two shortcuts keep it short. On a service page we simply ask whether the
// request is about that service. And if we already hold someone's details from
// a previous visit, we show them back rather than asking again.

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, HeartHandshake, Loader2, Pencil,
  ShieldCheck, Siren,
} from "lucide-react";

import { trackCareRequest, trackServiceInterest } from "@/lib/measurement";
import { submitCareRequest, sendEnquiryReply } from "@/lib/enquiries";
import {
  knowsVisitor, priorInterests, readVisitor, rememberInterest, visitorFirstName, writeVisitor,
} from "@/lib/visitor";
import {
  CARE_KINDS, CareKind, SOON_OPTIONS, WHATSAPP_NUMBER, WHO_LABEL, Who,
  emailOk, kindByLine,
} from "@/components/request/care-kinds";
import {
  Choice, DialCodeField, FieldLabel, Question, RequestShell, joinPhone,
} from "@/components/request/RequestShell";

export interface CarePrefill {
  name?: string;
  dial?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
  serviceLineKey?: string;
}

interface Props {
  /** Preselect a line, e.g. "eldercare" on the eldercare page. */
  serviceLineKey?: string;
  trigger?: React.ReactNode;
  source?: string;
  /** Optional controlled state, for triggers that live outside this component. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Answers carried in from another door, such as the welcome pop-up. */
  prefill?: CarePrefill;
  /** The person has just chosen this service elsewhere, so it is not asked again. */
  preconfirmed?: boolean;
}

/** Names are always held as two parts. A stored single name is split once. */
const splitName = (raw: string): { first: string; last: string } => {
  const parts = (raw || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
};

type StepKey = "confirm" | "recap" | "name" | "phone" | "email" | "consent" | "forWhom" | "who" | "kind" | "soon";

const CareRequestDialog = ({
  serviceLineKey, trigger, source = "request_care",
  open: openProp, onOpenChange: onOpenChangeProp, prefill, preconfirmed = false,
}: Props) => {
  const { toast } = useToast();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => { if (!controlled) setOpenState(next); onOpenChangeProp?.(next); };

  const pageKind = useMemo(
    () => kindByLine(prefill?.serviceLineKey ?? serviceLineKey),
    [prefill?.serviceLineKey, serviceLineKey],
  );

  const visitor = useMemo(() => (open ? readVisitor() : readVisitor()), [open]);
  const known = knowsVisitor(visitor);

  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [editContact, setEditContact] = useState(false);

  const initialName = splitName(prefill?.name ?? visitor.name);
  const [firstName, setFirstName] = useState(visitor.firstName || initialName.first);
  const [lastName, setLastName] = useState(visitor.lastName || initialName.last);
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const [dial, setDial] = useState(prefill?.dial ?? visitor.dial ?? "+234");
  const [phone, setPhone] = useState(prefill?.phone ?? visitor.phone);
  const [email, setEmail] = useState(prefill?.email ?? visitor.email);
  const [consent, setConsent] = useState(prefill?.consent ?? visitor.consent);

  const [confirmed, setConfirmed] = useState<"" | "yes" | "no">(preconfirmed ? "yes" : "");
  const [forWhom, setForWhom] = useState<"" | "me" | "else">("");
  const [who, setWho] = useState<Who | "">("");
  const [kind, setKind] = useState<CareKind | null>(pageKind);
  const [soon, setSoon] = useState("");
  const journeyRef = useRef<HTMLDivElement>(null);

  const contactKnown = known && !editContact;

  const steps: StepKey[] = useMemo(() => {
    const s: StepKey[] = [];
    if (pageKind && !preconfirmed) s.push("confirm");
    if (contactKnown) s.push("recap");
    else s.push("name", "phone", "email", "consent");
    if (!(pageKind && confirmed === "yes")) s.push("forWhom", "who", "kind");
    s.push("soon");
    return s;
  }, [pageKind, contactKnown, confirmed, preconfirmed]);

  const stepKey = steps[Math.min(index, steps.length - 1)];
  const stepNo = Math.min(index, steps.length - 1);

  useEffect(() => {
    journeyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  // A service page view is itself a signal of interest.
  useEffect(() => {
    if (open && pageKind) {
      rememberInterest(pageKind.line);
      trackServiceInterest(pageKind.line, source);
    }
  }, [open, pageKind, source]);

  const fullPhone = joinPhone(dial, phone);

  const kinds = useMemo(
    () => (who ? CARE_KINDS.filter((k) => k.who.includes(who as Who)) : CARE_KINDS),
    [who],
  );

  const reset = () => {
    const v = readVisitor();
    setIndex(0); setDone(false); setEditContact(false);
    const n = splitName(prefill?.name ?? v.name);
    setFirstName(v.firstName || n.first);
    setLastName(v.lastName || n.last);
    setDial(prefill?.dial ?? v.dial ?? "+234");
    setPhone(prefill?.phone ?? v.phone);
    setEmail(prefill?.email ?? v.email);
    setConsent(prefill?.consent ?? v.consent);
    setConfirmed(preconfirmed ? "yes" : ""); setForWhom(""); setWho("");
    setKind(pageKind);
    setSoon("");
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 250);
  };

  // Another copy of this form on the same page may have collected details since
  // this one was mounted. Re-read them whenever it opens, so the recap is never blank.
  useEffect(() => {
    if (!open) return;
    const v = readVisitor();
    const n = splitName(prefill?.name ?? v.name);
    setFirstName((f) => (f.trim() ? f : v.firstName || n.first));
    setLastName((l) => (l.trim() ? l : v.lastName || n.last));
    setDial((d) => prefill?.dial ?? (d && d !== "+234" ? d : v.dial || "+234"));
    setPhone((p) => prefill?.phone ?? (p.trim() ? p : v.phone));
    setEmail((e) => prefill?.email ?? (e.trim() ? e : v.email));
    setConsent((c) => prefill?.consent ?? (c || v.consent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Choices advance on their own, with a beat so the selection is seen.
  const pick = (fn: () => void) => {
    fn();
    window.setTimeout(next, 280);
  };

  const canContinue = (() => {
    switch (stepKey) {
      case "name": return firstName.trim().length > 1 && lastName.trim().length > 1;
      case "phone": return phone.trim().length > 5;
      case "email": return emailOk(email.trim());
      case "consent": return consent;
      case "recap":
        return firstName.trim().length > 1 && lastName.trim().length > 1
          && phone.trim().length > 5 && emailOk(email.trim()) && consent;

      default: return false;
    }
  })();

  const showContinue = ["name", "phone", "email", "consent", "recap"].includes(stepKey);

  /** The same summary we file on the enquiry desk, ready to send on WhatsApp. */
  const whatsappText = () => [
    "Hello Medic Connect, I have just sent a care request.",
    "",
    `Name: ${name.trim()}`,
    `WhatsApp: ${fullPhone}`,
    email.trim() ? `Email: ${email.trim()}` : "",
    `Care for: ${forWhom === "me" ? "myself" : who ? WHO_LABEL[who as Who] : "someone else"}`,
    `Kind of care: ${kind?.label ?? ""}`,
    `How soon: ${soon}`,
  ].filter(Boolean).join("\n");

  const submit = async () => {
    if (!kind || !soon || sending) return;
    setSending(true);
    try {
      const summary = [
        `Care for: ${forWhom === "me" ? "themselves" : who ? WHO_LABEL[who as Who] : "someone else"}`,
        `Kind of care: ${kind.label}`,
        `How soon: ${soon}`,
      ].join(". ");
      const earlier = priorInterests(readVisitor(), kind.line);
      const id = await submitCareRequest({
        name,
        firstName,
        lastName,
        email,
        phone: fullPhone,
        city: "",
        serviceLineKey: kind.line,
        serviceLineName: kind.label,
        message: summary,
        answers: {
          for_whom: forWhom === "me" ? "For me" : forWhom === "else" ? "For someone else" : "",
          who_needs_care: who ? WHO_LABEL[who as Who] : "",
          kind_of_care: kind.label,
          how_soon: soon,
          confirmed_from_page: pageKind ? `${pageKind.label} (${confirmed === "yes" ? "confirmed" : "changed"})` : "",
          prior_interests: earlier,
        },
        consentEmail: consent,
        source,
      });
      sendEnquiryReply(id).catch(() => undefined);
      trackCareRequest(kind.line);
      trackServiceInterest(kind.line, `${source}:submitted`);
      rememberInterest(kind.line);
      writeVisitor({
        name: name.trim(), firstName: firstName.trim(), lastName: lastName.trim(),
        dial, phone: phone.trim(), email: email.trim(),
        consent, lastRequestAt: new Date().toISOString(),
      });
      setDone(true);
    } catch (err) {
      toast({
        title: "That did not send",
        description: err instanceof Error ? err.message : "Please try again, or message us on WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const greeting = visitorFirstName(visitor);

  const heading: Record<StepKey, string> = {
    confirm: `Are you requesting ${pageKind?.label.toLowerCase() ?? "care"}?`,
    recap: greeting ? `Welcome back, ${greeting}.` : "Are these details still right?",
    name: "What is your name?",
    phone: "What is your WhatsApp number?",
    email: "What is your email address?",
    consent: "May we use these details to arrange your care?",
    forWhom: "Is this care for you, or for someone else?",
    who: forWhom === "me" ? "Which of these describes you?" : "Who needs the care?",
    kind: "What kind of care?",
    soon: "How soon do you need it?",
  };

  const help: Record<StepKey, string> = {
    confirm: "You are reading our page on this service, so we have filled it in for you.",
    recap: "We kept your details from last time, so this only takes a moment.",
    name: "We record a first name and a last name for every person.",
    phone: "A care adviser will use this number to contact you.",
    email: "We will send your care information and confirmation here.",
    consent: "Your details stay private and are used only to respond and arrange care.",
    forWhom: "Choose the answer that best fits your request.",
    who: "This helps us show only the care options that are relevant.",
    kind: "If you are not sure, choose the last option and we will work it out together.",
    soon: "Choose the closest timeframe.",
  };

  return (
    <>
      {(trigger !== undefined || !controlled) && (
        <RequestShellTrigger onOpen={() => setOpen(true)} trigger={trigger} />
      )}

      <RequestShell
        open={open}
        onOpenChange={onOpenChange}
        eyebrow="Request care"
        title={done ? "Request received" : "Request care"}
        step={done ? null : stepNo}
        total={done ? 0 : steps.length}
        chip={kind?.label ?? null}
        scrollRef={journeyRef}
        footer={done || !(stepNo > 0 || showContinue || stepKey === "soon") ? undefined : (
          <>
            {stepNo > 0 ? (
              <Button variant="ghost" className="rounded-xl text-body" onClick={back}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            ) : <span />}
            {showContinue && (
              <Button className="min-w-[136px] rounded-xl" onClick={next} disabled={!canContinue}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {stepKey === "soon" && (
              <Button className="min-w-[150px] rounded-xl" onClick={submit} disabled={!soon || !kind || sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Send request
              </Button>
            )}
          </>
        )}
      >
        {done ? (
          <div className="space-y-4 pb-2">
            <div className="space-y-3 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-hairline-warm bg-tint">
                <CheckCircle2 className="h-6 w-6 text-brand" />
              </span>
              <p className="text-[22px] font-bold text-navy">Your request has been received.</p>
              <p className="mx-auto max-w-[44ch] text-[14px] leading-[1.55] text-body">
                A care adviser will reach you on WhatsApp at {fullPhone}
                {email.trim() ? `, and a guide is on its way to ${email.trim()}` : ""}.
                Everything starts with a care needs assessment, and we will walk you through it.
              </p>
              <p className="mx-auto max-w-[44ch] text-[14px] leading-[1.55] text-body">
                Tap below to open WhatsApp with your answers already written out, so nothing has to be repeated.
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappText())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold text-primary-foreground"
              >
                Send on WhatsApp
              </a>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <Question heading={heading[stepKey]} help={help[stepKey]} stepKey={stepKey}>
            {stepKey === "confirm" && (
              <div className="grid gap-2">
                <Choice
                  label={`Yes, ${pageKind?.label.toLowerCase()}`}
                  blurb={pageKind?.blurb}
                  selected={confirmed === "yes"}
                  onClick={() => pick(() => { setConfirmed("yes"); setKind(pageKind); })}
                />
                <Choice
                  label="No, something else"
                  blurb="We will ask a couple of questions instead"
                  selected={confirmed === "no"}
                  onClick={() => pick(() => { setConfirmed("no"); setKind(null); })}
                />
              </div>
            )}

            {stepKey === "recap" && (
              <div className="space-y-3">
                <div className="space-y-2 rounded-xl border border-hairline-warm bg-tint/40 p-4">
                  <p className="text-[14px] font-semibold text-ink">{name}</p>
                  <p className="text-[13px] text-body">{fullPhone}</p>
                  <p className="text-[13px] text-body">{email}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-hairline-warm"
                  onClick={() => { setEditContact(true); setIndex(pageKind && !preconfirmed ? 1 : 0); }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Change my details
                </Button>
              </div>
            )}

            {stepKey === "name" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="cr-first-name">First name, required</FieldLabel>
                  <Input id="cr-first-name" value={firstName} maxLength={60} autoFocus
                    className="h-12 rounded-xl border-hairline-warm bg-background px-4 text-[16px]"
                    placeholder="e.g. Adaeze"
                    onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="cr-last-name">Last name, required</FieldLabel>
                  <Input id="cr-last-name" value={lastName} maxLength={60}
                    className="h-12 rounded-xl border-hairline-warm bg-background px-4 text-[16px]"
                    placeholder="e.g. Okonkwo"
                    onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            )}

            {stepKey === "phone" && (
              <div className="space-y-1.5">
                <FieldLabel htmlFor="cr-phone">WhatsApp number, required</FieldLabel>
                <DialCodeField id="cr-phone" dial={dial} phone={phone} onDial={setDial} onPhone={setPhone} autoFocus />
              </div>
            )}

            {stepKey === "email" && (
              <div className="space-y-1.5">
                <FieldLabel htmlFor="cr-email">Email address, required</FieldLabel>
                <Input id="cr-email" type="email" value={email} maxLength={255} autoFocus
                  className="h-12 rounded-xl border-hairline-warm bg-background px-4 text-[16px]"
                  placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)} />
                {email.length > 0 && !emailOk(email.trim()) && (
                  <p className="text-[12px] text-destructive">Enter a valid email address to continue.</p>
                )}
              </div>
            )}

            {stepKey === "consent" && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline-warm bg-tint/40 p-4 text-[14px] leading-[1.5] text-body">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                <span>
                  I agree to be contacted about my request, and to Medic Connect holding these
                  details to arrange care.
                </span>
              </label>
            )}

            {stepKey === "forWhom" && (
              <div className="grid gap-2">
                <Choice label="For me" blurb="I am the one who needs care"
                  selected={forWhom === "me"} onClick={() => pick(() => setForWhom("me"))} />
                <Choice label="For someone else" blurb="I am arranging care for a loved one"
                  selected={forWhom === "else"} onClick={() => pick(() => setForWhom("else"))} />
              </div>
            )}

            {stepKey === "who" && (
              <div className="grid gap-2">
                {(forWhom === "me"
                  ? [
                      { w: "pregnant" as Who, label: "I'm pregnant, or a new mother" },
                      { w: "adult" as Who, label: "I'm an adult" },
                      { w: "older" as Who, label: "I'm an older person" },
                    ]
                  : [
                      { w: "pregnant" as Who, label: "Someone pregnant, or a new mother" },
                      { w: "baby" as Who, label: "A baby or newborn" },
                      { w: "child" as Who, label: "A child" },
                      { w: "adult" as Who, label: "An adult" },
                      { w: "older" as Who, label: "An older person" },
                    ]
                ).map(({ w, label }) => (
                  <Choice key={w} label={label} selected={who === w}
                    onClick={() => pick(() => {
                      setWho(w);
                      // The kind list is about to change; drop a kind that no longer fits.
                      setKind((k) => (k && k.who.includes(w) ? k : null));
                    })} />
                ))}
              </div>
            )}

            {stepKey === "kind" && (
              <div className="grid gap-2">
                {kinds.map((k) => (
                  <Choice key={k.line} label={k.label} blurb={k.blurb}
                    selected={kind?.line === k.line}
                    onClick={() => pick(() => { setKind(k); rememberInterest(k.line); trackServiceInterest(k.line, source); })} />
                ))}
              </div>
            )}

            {stepKey === "soon" && (
              <div className="space-y-3">
                <div className="grid gap-2">
                  {SOON_OPTIONS.map((o) => (
                    <Choice key={o} label={o} selected={soon === o} onClick={() => setSoon(o)} />
                  ))}
                </div>
                {soon === "Within 48 hours" && (
                  <div className="flex animate-in gap-3 rounded-xl border border-brand/30 bg-tint p-3.5 fade-in slide-in-from-top-2 duration-300">
                    <Siren className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <div className="space-y-1 text-[13px] leading-[1.45] text-body">
                      <p className="font-semibold text-ink">We treat this as urgent.</p>
                      <p>
                        Send your request and a care adviser will come back to you the same working
                        day. For a medical emergency, please call your local emergency services first.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5 text-[12px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <p>Your details stay private and are only used to arrange your care.</p>
                </div>
              </div>
            )}
          </Question>
        )}
      </RequestShell>
    </>
  );
};

/** The button that opens the journey, kept out of the dialog so the shell stays generic. */
const RequestShellTrigger = ({ onOpen, trigger }: { onOpen: () => void; trigger?: React.ReactNode }) =>
  trigger ? (
    <span className="contents" onClick={onOpen}>{trigger}</span>
  ) : (
    <button
      type="button"
      onClick={onOpen}
      className="kit-curve-sm inline-flex items-center gap-2 bg-brand px-6 py-3 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      <HeartHandshake className="h-4 w-4" />
      Request care
    </button>
  );

export default CareRequestDialog;
