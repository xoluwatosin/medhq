// Candidate home. Facts imported from documents stay as proposals until the
// candidate confirms or corrects them, then quiet links lead to everything else.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import FieldAnswerInput from "@/components/portal/FieldAnswerInput";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import VerifiedBadge from "@/components/VerifiedBadge";
import Readiness from "@/components/candidate/Readiness";
import { Chevrons, TapeLabel } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import { TRACK_ART_BY_ID } from "@/components/candidate/track-art";
import {
  CxButton, CxCard, CxEmpty, CxEyebrow, CxFixBlock, CxPill, CxRow, CxRows, CxSection, CxField, cxInputClass,
} from "@/components/candidate/primitives";
import { Navigate } from "react-router-dom";
import { usePortalMode } from "@/hooks/usePortalMode";
import { usePortal, type PortalRow } from "./usePortal";
import { savePortalField, updateOwnProfile } from "@/lib/portal-actions";
import { candidateFieldExplanation } from "@/lib/candidate-field-copy";

/** Candidate copy is deliberately separate from parser and admin terminology. */
const QUESTION_LABELS: Record<string, string> = {
  state: "Which state do you live in?",
  lga: "Which local government area do you live in?",
  profession: "What is your profession?",
  profession_text: "How would you describe your role?",
  current_position: "What is your current role?",
  position: "What role do you currently hold?",
  current_employer: "Who do you currently work for?",
  employer: "Which employers are listed in your work history?",
  qualification: "Which qualifications do you hold?",
  qualifications: "Which qualifications do you hold?",
  education: "Is this education history correct?",
  certifications: "Which professional certificates do you hold?",
  licensing_body: "Which professional body licenses you?",
  license_number: "What is your professional licence number?",
  license_expiry: "When does your professional licence expire?",
  languages: "Which languages can you speak confidently?",
  specialisms: "Which areas do you specialise in?",
  clinical_skills: "Which clinical skills do you have?",
  sex: "What is your sex?",
  right_to_work: "Are you legally allowed to work in Nigeria?",
  nysc_status: "What is your NYSC status?",
  track: "Which candidate route best describes you?",
  institution: "Which institution do you attend?",
  course_of_study: "What course are you studying?",
  study_level: "What qualification are you studying towards?",
  year_of_study: "Which year of study are you in?",
  expected_graduation: "When do you expect to graduate?",
  joining_statement: "What do you hope to gain from joining us?",
  references: "Who can provide a reference for you?",
  work_preferences: "What kind of work would you prefer?",
  availability: "When are you available to work?",
  cv: "Please upload your CV",
  documents: "Please add the documents we requested",
  nysc_certificate: "Please upload your NYSC certificate",
};

/** In-page targets are plain anchors; routes are router links. */
const NextLink = ({ to, className, children }: { to: string; className: string; children: React.ReactNode }) =>
  to.startsWith("#") ? (
    <a href={to} className={className}>{children}</a>
  ) : (
    <Link to={to} className={className}>{children}</Link>
  );

const label = (field: string) => QUESTION_LABELS[field] ?? "Please check this information";

const PortalAccount = () => {
  const { toast } = useToast();
  const p = usePortal();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [address, setAddress] = useState({ line: "", landmark: "", area: "" });
  // Same account, two modes. Someone now on the Workforce is not shown
  // candidate screens as though nothing had changed.
  const lifecycle = usePortalMode();

  // The first question stands open, so there is always somewhere to start.
  const openId = open ?? p.attention[0]?.id ?? null;

  const save = async (r: PortalRow) => {
    const value = (values[r.id] ?? r.value ?? "").trim();
    if (!value) {
      toast({ title: "Add an answer first", variant: "destructive" });
      return;
    }
    setBusy(r.id);
    const { error } = await savePortalField(p.person.id, r, value);
    setBusy(null);
    if (error) {
      toast({ title: "We could not save that", description: "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Answer saved", description: "We will now use the information you confirmed." });
    p.reload();
  };

  const saveAddress = async () => {
    if (!address.line.trim()) {
      toast({ title: "Add your street address first", variant: "destructive" });
      return;
    }
    setSavingAddress(true);
    const { error } = await updateOwnProfile({
      address_line: address.line,
      address_landmark: address.landmark,
      address_area: address.area,
    });
    setSavingAddress(false);
    if (error) {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Your home address is on your profile now." });
    setAddress({ line: "", landmark: "", area: "" });
    p.reload();
  };

  const first = p.person?.full_name?.split(" ")[0] ?? "there";
  const addressDone = Boolean(p.person?.address_line);

  // One question, wherever it sits. The must-answer list and the quieter review
  // list read the same way, so nothing feels like a different kind of ask.
  const question = (r: PortalRow) => {
    const isOpen = openId === r.id;
    const explanation = candidateFieldExplanation(r);
    return (
      <div key={r.id} className="px-5 py-4 sm:px-[22px]">
        <button
          type="button"
          onClick={() => setOpen(isOpen ? "" : r.id)}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex-1 text-[15.5px] font-bold text-ink">{label(r.field)}</span>
          <CxPill tone={r.status === "missing" ? "quiet" : "needs-you"}>
            {r.status === "missing" ? "Not on file" : r.value ? "Confirm or correct" : "Needs you"}
          </CxPill>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-body transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {isOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {explanation && <CxFixBlock>{explanation}</CxFixBlock>}
            {r.route ? (
              <div>
                <CxButton asChild className="sm:w-auto">
                  <Link to={r.route}>{r.action ?? "Open"}</Link>
                </CxButton>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="flex-1">
                  <FieldAnswerInput
                    field={r.field}
                    personState={p.person?.state}
                    personProfession={p.person?.profession}
                    value={values[r.id] ?? r.value ?? ""}
                    onChange={(v) => setValues((prev) => ({ ...prev, [r.id]: v }))}
                  />
                </div>
                <CxButton onClick={() => save(r)} disabled={busy === r.id} className="sm:w-40">
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : r.value ? "Confirm answer" : "Save answer"}
                </CxButton>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  const docsNeedYou = p.required.length - p.acceptedRequired > 0 || p.openRequests > 0;
  const steps = [
    { label: "CV", done: p.hasCv },
    { label: "Documents", done: !docsNeedYou },
    ...(p.rules.needsAvailability ? [{ label: "Availability", done: p.availabilitySet }] : []),
    { label: "Preferences", done: p.prefsDone },
    { label: "Questions", done: p.attention.length === 0 },
  ];

  const next = !p.hasCv
    ? { to: "/portal/documents", art: art.objFolderDocuments, title: "Start with your CV", body: "Upload it once and we read your employers, qualifications and skills out of it, so you confirm instead of typing.", action: "Upload your CV", done: false }
    : p.attention.length > 0
      ? { to: "#questions", art: art.objClipboardChecks, title: label(p.attention[0].field), body: p.attention.length === 1 ? "One question is waiting for you below." : `${p.attention.length} questions are waiting for you below.`, action: "Answer now", done: false }
      : !p.prefsDone
        ? { to: "/portal/preferences", art: art.objHandsHeart, title: "Tell us the work you want", body: "The care you take, live-in or live-out, and the shifts that suit you. We cannot put you forward without it.", action: "Set preferences", done: false }
        : p.rules.needsAvailability && !p.availabilitySet
          ? { to: "/portal/availability", art: art.objCalendarSeven, title: "Say when you can work", body: "Set your usual week once. We only bring you work you can take.", action: "Set availability", done: false }
          : docsNeedYou
            ? { to: "/portal/documents", art: art.objFolderDocuments, title: "Finish your documents", body: "Some of what we need is still to come in or still being checked.", action: "Open documents", done: false }
            : { to: "/portal/offers", art: art.objHandshake, title: "You are ready to be put forward", body: "We will come to you when a role fits, and email you if anything expires.", action: "See offers", done: true };

  const tiles = [
    { to: "/portal/documents", art: art.objFolderDocuments, title: "Documents", line: "Your CV, licence and certificates, checked once.", state: p.openRequests > 0 ? "Requested" : docsNeedYou ? "In progress" : "Done", needs: p.openRequests > 0 || !p.hasCv },
    ...(p.rules.needsAvailability
      ? [{ to: "/portal/availability", art: art.objCalendarSeven, title: "Availability", line: "The days you can work.", state: p.availabilitySet ? "Done" : "Needs you", needs: !p.availabilitySet }]
      : []),
    { to: "/portal/preferences", art: art.objHandsHeart, title: "Work preferences", line: "The care you take and the shifts that suit you.", state: p.prefsDone ? "Done" : "Needs you", needs: !p.prefsDone },
    { to: "/portal/offers", art: art.objHandshake, title: "Offers", line: "Work offered to you.", state: p.openOffers > 0 ? "Needs you" : "None yet", needs: p.openOffers > 0 },
    { to: "/portal/applications", art: art.objClipboardChecks, title: "Applications", line: "Roles you have applied for.", state: "Open", needs: false },
    { to: "/portal/details", art: art.objIdVerification, title: "Your details", line: "What we hold about you.", state: addressDone ? "On file" : "Add address", needs: false },
  ];

  if (!lifecycle.loading && lifecycle.mode?.mode === "workforce") {
    return <Navigate to="/portal/workforce" replace />;
  }

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Home"
      eyebrow="Your profile"
      heroTitle={`Hello, ${first}.`}
      intro={p.outstanding === 0
        ? "Everything we need is in. We will come to you when a role fits."
        : "Check what we hold about you, fix anything wrong, then add what is missing."}
      hero={
        <>
          <Readiness steps={steps} onNavy />
          {p.person?.verification_state === "verified" && (
            <div className="mt-5">
              <VerifiedBadge state={p.person.verification_state} reqs={p.reqs} size="lg" onNavy />
            </div>
          )}
        </>
      }
      art={TRACK_ART_BY_ID[p.person?.track] ?? art.charNurse}
      headerAction={
        <Link
          to="/portal/details"
          aria-label="Your details"
          className="flex h-11 w-11 items-center justify-center text-white"
        >
          <User className="h-[18px] w-[18px]" />
        </Link>
      }

    >
      {/* Phones: where you stand, under the slim header. */}
      <div className="md:hidden">
        <p className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.045em] text-navy">Hello, {first}.</p>
        <p className="mt-2 text-[15px] leading-[1.6] text-body">
          {p.outstanding === 0
            ? "Everything we need is in. We will come to you when a role fits."
            : "Check what we hold about you, fix anything wrong, then add what is missing."}
        </p>
        <div className="mt-4">
          <Readiness steps={steps} />
        </div>
      </div>

      {/* The one thing to do next, hanging under the hero. */}
      <NextLink
        to={next.to}
        className="group relative flex flex-col gap-4 border-2 border-navy bg-white p-6 shadow-offset transition-colors hover:bg-tint sm:flex-row sm:items-center sm:gap-6 sm:p-7 md:-mt-[76px]"
      >
        <img src={next.art} alt="" className="absolute right-4 top-4 h-[56px] w-[56px] object-contain sm:static sm:h-[84px] sm:w-[84px] sm:shrink-0" />
        <div className="min-w-0 flex-1">
          <TapeLabel tone={next.done ? "tint" : "blue"} tilt={-2} className="!text-[11px]">
            {next.done ? "ALL SET" : "DO THIS NEXT"}
          </TapeLabel>
          <p className="mt-3 text-[22px] font-extrabold leading-[1.15] tracking-[-0.035em] text-navy sm:text-[26px]">{next.title}</p>
          <p className="mt-1.5 max-w-[60ch] text-[15px] leading-[1.6] text-body">{next.body}</p>
        </div>
        <span className="inline-flex min-h-[48px] shrink-0 items-center gap-3 self-start bg-navy px-5 text-[15.5px] font-extrabold text-white shadow-[4px_4px_0_hsl(var(--brand))] group-hover:bg-brand sm:self-center">
          {next.action}
          <Chevrons size={12} />
        </span>
      </NextLink>

      {/* Every part of the profile, as a tile with its state. */}
      <section aria-label="Your profile">
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
          {tiles.map((t, i) => (
            <li key={t.to}>
              <Link
                to={t.to}
                style={{ ["--mc-tilt" as string]: `${[-0.8, 0.6, -0.5][i % 3]}deg` }}
                className={cn(
                  "mc-tilt relative flex h-full flex-col gap-2 border-2 p-4 transition-colors sm:p-5",
                  t.needs ? "border-navy bg-white shadow-offset hover:bg-tint" : "border-navy/15 bg-white hover:border-navy",
                )}
              >
                <img src={t.art} alt="" className="h-[64px] w-[64px] object-contain sm:h-[76px] sm:w-[76px]" />
                <p className="mt-1 text-[17px] font-extrabold leading-[1.2] tracking-[-0.025em] text-navy sm:text-[19px]">{t.title}</p>
                <p className="hidden text-[14px] leading-[1.5] text-body sm:block">{t.line}</p>
                <span className="mt-auto pt-2">
                  <span
                    className={cn(
                      "inline-block px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]",
                      t.needs ? "bg-price text-white" : t.state === "Done" || t.state === "On file" ? "bg-brand text-white" : "bg-tint text-navy",
                    )}
                  >
                    {t.state}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div id="questions" className="scroll-mt-24" />
      <CxSection
        title="Questions for you"
        intro="These are the answers we cannot put you forward without. Confirm anything we already hold, correct it where necessary, and add what is missing."
      >
        <CxCard kind={p.attention.length > 0 ? "needs-you" : "quiet"}>
          {p.attention.length === 0 ? (
            <CxEmpty>Nothing needs your attention. We will email you if that changes.</CxEmpty>
          ) : (
            <CxRows>{p.attention.map(question)}</CxRows>
          )}
        </CxCard>
      </CxSection>

      {(p.later.length > 0 || !addressDone) && (
        <CxSection
          title="Review when you have time"
          intro="None of this holds you up. It sharpens the roles we bring you."
        >
          <CxCard kind="quiet">
            <CxRows>
              {p.later.map(question)}
              {!addressDone && (
                <div className="px-5 py-4 sm:px-[22px]">
                  <p className="text-[15.5px] font-bold text-ink">Your home address</p>
                  <p className="mt-1 cx-measure text-[14.5px] leading-relaxed text-body">
                    Give it to us and we can send you work close to home.
                  </p>
                  <div className="mt-3 grid gap-3">
                    <CxField label="Street address" helper="House number and street.">
                      <AddressAutocomplete
                        value={address.line}
                        onChange={(v) => setAddress((a) => ({ ...a, line: v }))}
                        placeholder="12 Awolowo Road"
                      />
                    </CxField>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <CxField label="Nearest landmark">
                        <input
                          value={address.landmark}
                          onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))}
                          placeholder="Beside the primary health centre"
                          className={cxInputClass()}
                        />
                      </CxField>
                      <CxField label="Your area" helper="Only if it differs from your LGA.">
                        <input
                          value={address.area}
                          onChange={(e) => setAddress((a) => ({ ...a, area: e.target.value }))}
                          placeholder="Ikoyi"
                          className={cxInputClass()}
                        />
                      </CxField>
                    </div>
                    <CxButton onClick={saveAddress} disabled={savingAddress} className="sm:w-40">
                      {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save address"}
                    </CxButton>
                  </div>
                </div>
              )}
            </CxRows>
          </CxCard>
        </CxSection>
      )}



    </CxPortalPage>
  );
};

export default PortalAccount;