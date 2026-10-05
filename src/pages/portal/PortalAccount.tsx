// Candidate home. Facts imported from documents stay as proposals until the
// candidate confirms or corrects them, then quiet links lead to everything else.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import FieldAnswerInput from "@/components/portal/FieldAnswerInput";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import VerifiedBadge from "@/components/VerifiedBadge";
import { art } from "@/components/mc/art";
import { TRACK_ART_BY_ID } from "@/components/candidate/track-art";
import { CxNavyWatermark } from "@/components/candidate/CxShell";
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


  if (!lifecycle.loading && lifecycle.mode?.mode === "workforce") {
    return <Navigate to="/portal/workforce" replace />;
  }

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Home"
      eyebrow="Candidate portal"
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
      {/* The one navy surface on this screen: who you are and where you stand. */}
      <CxCard kind="navy" className="p-6 sm:p-7">
        <CxNavyWatermark />
        <img
          src={TRACK_ART_BY_ID[p.person?.track] ?? art.charNurse}
          alt=""
          className="pointer-events-none absolute -bottom-7 right-6 hidden h-[230px] object-contain lg:block"
        />
        <div className="relative z-10 lg:pr-[200px]">
          <CxEyebrow onNavy>Good to see you</CxEyebrow>
          <h2 className="cx-heading mt-2 text-[24px] text-white sm:text-[28px]">{first}</h2>
          <p className="mt-2.5 cx-measure text-[15px] leading-relaxed text-body-navy">
            {p.outstanding === 0
              ? "Everything we need is in. We will come to you when a role fits, and email you if anything expires."
              : "Please check what we already know about you, correct anything that is wrong, then add what is missing."}
          </p>
          {p.attention.length > 0 && (
            <p className="mt-4 text-[14.5px] font-bold text-white">
              {p.attention.length === 1
                ? "One question is waiting for you below."
                : `${p.attention.length} questions are waiting for you below.`}
            </p>
          )}
          {p.person?.verification_state === "verified" && (
            <div className="mt-5">
              <VerifiedBadge state={p.person.verification_state} reqs={p.reqs} size="lg" onNavy />
            </div>
          )}
        </div>
      </CxCard>


      {!p.hasCv && (
        <CxCard kind="needs-you" className="p-5 sm:p-6">
          <p className="text-[16px] font-bold text-ink">Start with your CV</p>
          <p className="mt-1.5 cx-measure text-[14.5px] leading-relaxed text-body">
            Upload it once and we read your employers, qualifications and skills out of it.
            You then confirm what we found instead of typing it all out.
          </p>
          <div className="mt-3.5">
            <CxButton asChild className="sm:w-auto">
              <Link to="/portal/documents">Upload your CV</Link>
            </CxButton>
          </div>
        </CxCard>
      )}

      <CxSection
        title="What we need from you"
        intro="These are the answers we cannot put you forward without. Confirm anything we already hold, correct it where necessary, and add what is missing."
      >
        <CxCard kind={p.attention.length > 0 ? "needs-you" : "quiet"}>
          {p.attention.length === 0 ? (
            <CxEmpty art={art.objShieldCheck}>Nothing needs your attention. We will email you if that changes.</CxEmpty>
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



      <CxSection title="Where you stand" intro="Tap anything to open it.">
        <CxCard>
          <CxRows>
            <CxRow
              art={art.objHandshake}
              title="Offers"
              sentence={p.openOffers > 0
                ? "Work has been offered to you and we are waiting on your answer."
                : "Nothing waiting on you right now."}
              right={
                <>
                  {p.openOffers > 0 && <CxPill tone="needs-you">Needs you</CxPill>}
                  <CxButton rank="tertiary" asChild><Link to="/portal/offers">Open</Link></CxButton>
                </>
              }
            />
            <CxRow
              art={art.objFolderDocuments}
              title="Documents"
              sentence={p.required.length - p.acceptedRequired > 0 || p.openRequests > 0
                ? "Some of what we need is still to come in or still being checked."
                : "Everything we asked for is on file and accepted."}
              right={
                <>
                  {p.openRequests > 0 && <CxPill tone="needs-you">Requested</CxPill>}
                  <CxButton rank="tertiary" asChild><Link to="/portal/documents">Open</Link></CxButton>
                </>
              }
            />
            {p.rules.needsAvailability && (
              <CxRow
                art={art.objCalendarSeven}
                title="Your availability"
                sentence={p.availabilitySet
                  ? "Set. Keep it current so we only bring you work you can take."
                  : "Tell us the dates you can work. Without it we cannot put you forward."}
                right={
                  <>
                    <CxPill>{p.availabilitySet ? "Set" : "Needs you"}</CxPill>
                    <CxButton rank="tertiary" asChild><Link to="/portal/availability">Open</Link></CxButton>
                  </>
                }
              />
            )}
            <CxRow
              art={art.objHandsHeart}
              title="Work preferences"
              sentence={p.prefsDone
                ? "We match on these. Change them whenever your situation changes."
                : "Required. Tell us the care you take, live-in or live-out, and the shifts that suit you."}
              right={
                <>
                  <CxPill>{p.prefsDone ? "Done" : "Needs you"}</CxPill>
                  <CxButton rank="tertiary" asChild><Link to="/portal/preferences">Open</Link></CxButton>
                </>
              }
            />
            <CxRow
              art={art.objClipboardChecks}
              title="Applications"
              sentence="Every role you have applied for and where it stands."
              right={<CxButton rank="tertiary" asChild><Link to="/portal/applications">Open</Link></CxButton>}
            />
            {addressDone && (
              <CxRow
                art={art.objMapPinHome}
                title="Your home address"
                sentence="On file. It helps us send you work close to home."
                right={<CxPill tone="settled">On file</CxPill>}
              />
            )}

          </CxRows>
        </CxCard>
      </CxSection>

    </CxPortalPage>
  );
};

export default PortalAccount;