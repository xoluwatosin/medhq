// Who may see this client's record, why they may see it, and how to change it.
//
// Everything here is a decision recorded in the database and enforced there.
// The screen never shows access the server has not already accepted: after any
// change it reloads and shows server truth. Authority comes from a recorded
// basis, never from a relationship label.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { cxInputClass } from "@/components/candidate/primitives";
import {
  CareConfirm, CareField as CareFormRow, CareSheet,
} from "@/components/admin/care/CareSurface";

import { supabase } from "@/integrations/supabase/client";
import { MuEmpty, MuRow, MuSection } from "@/components/admin/mu/MuShell";
import { Status, StatusTone } from "@/components/field";
import { formatDate } from "@/lib/format";

/** The seven recorded reasons somebody may see a care record. */
export const BASIS_KINDS = [
  { value: "self_identity", label: "Self identity" },
  { value: "guardian_authority", label: "Guardian authority" },
  { value: "client_consent", label: "Client consent" },
  { value: "authorised_representative", label: "Authorised representative" },
  { value: "court_or_legal_instrument", label: "Court or legal instrument" },
  { value: "clinical_referral_disclosure", label: "Clinical referral disclosure" },
  { value: "finance_participant", label: "Finance participant" },
] as const;

const BASIS_LABEL: Record<string, string> =
  Object.fromEntries(BASIS_KINDS.map((b) => [b.value, b.label]));

/** A basis that can carry clinical scope. Finance has its own single basis. */
const CLINICAL_BASES = [
  "self_identity", "guardian_authority", "client_consent",
  "authorised_representative", "court_or_legal_instrument",
];

const GRANT_STATE: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Access open", tone: "good" },
  invited: { label: "Invited", tone: "progress" },
  suspended: { label: "Suspended", tone: "warning" },
  revoked: { label: "Revoked", tone: "bad" },
};

const DELIVERY: Record<string, { label: string; tone: StatusTone }> = {
  queued: { label: "Waiting to send", tone: "progress" },
  sending: { label: "Sending", tone: "progress" },
  sent: { label: "Invitation sent", tone: "good" },
  failed: { label: "Invitation not delivered", tone: "warning" },
  cancelled: { label: "Send stopped", tone: "neutral" },
};

const invitationState = (invite: Invitation | null) => {
  if (!invite) return "not_sent" as const;
  if (invite.revoked_at) return "withdrawn" as const;
  if (invite.accepted_at) return "accepted" as const;
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) return "expired" as const;
  return "pending" as const;
};

interface Basis {
  id: string;
  basis_kind: string;
  evidence_note: string | null;
  evidence_sighted: boolean | null;
  recorded_at: string | null;
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
}

interface Invitation {
  id: string;
  expires_at: string | null;
  accepted_at: string | null;
  first_opened_at: string | null;
  revoked_at: string | null;
  destination: string | null;
  delivery_status: string | null;
  delivery_error: string | null;
  delivery_attempts: number | null;
  notification_id: string | null;
}

interface AccessPerson {
  person_id: string;
  person_name: string;
  email: string | null;
  phone: string | null;
  contact_id: string | null;
  relationship: string | null;
  is_primary: boolean;
  is_payer: boolean;
  grant_id: string | null;
  grant_state: string | null;
  journey_scope: boolean;
  clinical_scope: boolean;
  finance_scope: boolean;
  grant_reason: string | null;
  granted_at: string | null;
  revoked_reason: string | null;
  clinical_basis_id: string | null;
  finance_basis_id: string | null;
  bases: Basis[];
  invitation: Invitation | null;
}

const liveBases = (person: AccessPerson) => person.bases.filter((b) => !b.withdrawn_at);

/** What a person can currently see, as a sentence rather than three chips. */
const scopeSentence = (p: AccessPerson) => {
  if (!p.grant_id) return "No access to this record";
  if (p.grant_state !== "active") return "No access while this is not open";
  const parts: string[] = [];
  if (p.journey_scope) parts.push("the journey");
  if (p.clinical_scope) parts.push("the care plan");
  if (p.finance_scope) parts.push("invoices and payments");
  if (parts.length === 0) return "No access to this record";
  if (parts.length === 1) return `Can see ${parts[0]}`;
  return `Can see ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

export const AccessSection = ({
  clientId,
  canAdminister,
  onChanged,
}: {
  clientId: string;
  canAdminister: boolean;
  onChanged?: () => void;
}) => {
  const [people, setPeople] = useState<AccessPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [basisFor, setBasisFor] = useState<AccessPerson | null>(null);
  const [basisDraft, setBasisDraft] = useState({ kind: "", note: "", sighted: false });

  const [grantFor, setGrantFor] = useState<AccessPerson | null>(null);
  const [grantDraft, setGrantDraft] = useState({
    journey: true, clinicalBasis: "none", financeBasis: "none", reason: "",
  });

  const [reasonFor, setReasonFor] = useState<
    { person: AccessPerson; action: "suspend" | "reactivate" | "revoke" | "withdraw"; basisId?: string } | null
  >(null);
  const [reasonText, setReasonText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("care_access_overview", { _client_id: clientId });
    setLoading(false);
    if (error) { toast.error("Could not load access"); return; }
    setPeople(((data ?? []) as unknown[]).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...r,
        bases: (Array.isArray(r.bases) ? r.bases : []) as Basis[],
        invitation: (r.invitation ?? null) as Invitation | null,
      } as AccessPerson;
    }));
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const after = async (message: string) => {
    toast.success(message);
    await load();
    onChanged?.();
  };

  const fail = (error: { message?: string } | null, fallback: string) => {
    const raw = error?.message ?? "";
    // The database refuses in plain language; show that rather than a code.
    toast.error(raw && !raw.includes("SQLSTATE") ? raw.replace(/^.*?:\s*/, "") || fallback : fallback);
  };

  /* ---------------- basis ---------------- */
  const recordBasis = async () => {
    if (!basisFor || !basisDraft.kind) { toast.error("Choose the reason for access"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("care_basis_record", {
      _client_id: clientId,
      _person_id: basisFor.person_id,
      _basis_kind: basisDraft.kind,
      _evidence_note: basisDraft.note.trim() || undefined,
      _evidence_sighted: basisDraft.sighted,
    });
    setBusy(false);
    if (error) { fail(error, "Could not record the reason for access"); return; }
    setBasisFor(null);
    setBasisDraft({ kind: "", note: "", sighted: false });
    await after("Reason for access recorded");
  };

  /* ---------------- grant ---------------- */
  const saveGrant = async () => {
    if (!grantFor) return;
    if (!grantDraft.reason.trim()) { toast.error("Give a reason for this decision"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("care_grant_set", {
      _client_id: clientId,
      _person_id: grantFor.person_id,
      _journey: grantDraft.journey,
      _clinical_basis_id: grantDraft.clinicalBasis === "none" ? null : grantDraft.clinicalBasis,
      _finance_basis_id: grantDraft.financeBasis === "none" ? null : grantDraft.financeBasis,
      _reason: grantDraft.reason.trim(),
    } as never);
    setBusy(false);
    if (error) { fail(error, "Could not change access"); return; }
    setGrantFor(null);
    await after("Access updated");
  };

  const runReason = async () => {
    if (!reasonFor) return;
    if (!reasonText.trim()) { toast.error("Give a reason"); return; }
    setBusy(true);
    const { person, action, basisId } = reasonFor;
    const call =
      action === "withdraw"
        ? supabase.rpc("care_basis_withdraw", { _basis_id: basisId!, _reason: reasonText.trim() })
        : action === "suspend"
        ? supabase.rpc("care_grant_suspend", { _grant_id: person.grant_id!, _reason: reasonText.trim() })
        : action === "reactivate"
        ? supabase.rpc("care_grant_reactivate", { _grant_id: person.grant_id!, _reason: reasonText.trim() })
        : supabase.rpc("care_grant_revoke", { _grant_id: person.grant_id!, _reason: reasonText.trim() });
    const { error } = await call;
    setBusy(false);
    if (error) {
      fail(error, "Could not make that change");
      return;
    }
    setReasonFor(null);
    setReasonText("");
    await after(
      action === "withdraw" ? "Reason for access withdrawn"
        : action === "suspend" ? "Access suspended"
        : action === "reactivate" ? "Access reopened"
        : "Access revoked",
    );
  };

  // Payers, and their shares, are set on the Commercial tab.
  const sendInvitation = async (person: AccessPerson, retry = false) => {
    if (!person.grant_id) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("care-portal-invite", {
      body: retry && person.invitation?.notification_id
        ? { action: "retry", notification_id: person.invitation.notification_id }
        : { grant_id: person.grant_id },
    });
    setBusy(false);
    const problem = error ? "Could not send the invitation" : (data as { error?: string } | null)?.error;
    if (problem) { toast.error(problem); await load(); return; }
    const status = (data as { status?: string } | null)?.status;
    if (status === "sent") await after("Invitation sent");
    else { toast.error("The invitation was not delivered"); await load(); }
  };

  const openGrant = (person: AccessPerson) => {
    setGrantDraft({
      journey: person.journey_scope || !person.grant_id,
      clinicalBasis: person.clinical_basis_id ?? "none",
      financeBasis: person.finance_basis_id ?? "none",
      reason: "",
    });
    setGrantFor(person);
  };

  const grantPerson = grantFor ? people.find((p) => p.person_id === grantFor.person_id) ?? grantFor : null;
  const clinicalOptions = useMemo(
    () => (grantPerson ? liveBases(grantPerson).filter((b) => CLINICAL_BASES.includes(b.basis_kind)) : []),
    [grantPerson],
  );
  const financeOptions = useMemo(
    () => (grantPerson ? liveBases(grantPerson).filter((b) => b.basis_kind === "finance_participant") : []),
    [grantPerson],
  );

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading access</p>;

  return (
    <div className="space-y-4">
      <MuSection
        title="Access"
        description="Who may see this record, and the recorded reason each of them may see it."
        padded={false}
      >
        {people.length === 0 ? (
          <MuEmpty
            icon={ShieldCheck}
            title="No people on this record"
            description="Add a contact first. Access is given to a person, for one client at a time."
          />
        ) : (
          <div className="divide-y divide-line-soft">
            {people.map((person) => {
              const state = person.grant_id
                ? GRANT_STATE[person.grant_state ?? ""] ?? { label: person.grant_state ?? "", tone: "neutral" as StatusTone }
                : { label: "No access", tone: "neutral" as StatusTone };
              const live = liveBases(person);
              const invite = person.invitation;
              const delivery = invite?.delivery_status ? DELIVERY[invite.delivery_status] : null;
              const inviteState = invitationState(invite);

              return (
                <div key={person.person_id} className="space-y-1 py-1">
                  <MuRow
                    title={person.person_name}
                    state={
                      <span className="flex flex-col gap-0.5">
                        <span>{person.relationship || "No relationship recorded"}</span>
                        {person.is_primary && <span>Main contact</span>}
                        {person.is_payer && <span>Payer</span>}
                        <span>{scopeSentence(person)}</span>
                        {person.grant_state === "revoked" && person.revoked_reason && (
                          <span>Reason for revoking: {person.revoked_reason}</span>
                        )}
                      </span>
                    }
                    status={<Status label={state.label} tone={state.tone} />}
                    action={
                      canAdminister ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setBasisFor(person)}>
                            Record reason
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openGrant(person)}>
                            {person.grant_id ? "Change access" : "Give access"}
                          </Button>
                          {person.grant_state === "active" && (
                            <Button size="sm" variant="outline"
                              onClick={() => { setReasonText(""); setReasonFor({ person, action: "suspend" }); }}>
                              Suspend
                            </Button>
                          )}
                          {person.grant_state === "suspended" && (
                            <Button size="sm" variant="outline"
                              onClick={() => { setReasonText(""); setReasonFor({ person, action: "reactivate" }); }}>
                              Reopen
                            </Button>
                          )}
                          {person.grant_id && person.grant_state !== "revoked" && (
                            <Button size="sm" variant="outline"
                              onClick={() => { setReasonText(""); setReasonFor({ person, action: "revoke" }); }}>
                              Revoke
                            </Button>
                          )}
                        </div>
                      ) : null
                    }
                  />

                  {/* Recorded reasons for access. */}
                  {live.length > 0 && (
                    <div className="space-y-1 px-5 pb-2">
                      {live.map((b) => (
                        <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                          <Status label={BASIS_LABEL[b.basis_kind] ?? b.basis_kind} tone="info" />
                          <span className="flex flex-col gap-0.5">
                            <span>Recorded {formatDate(b.recorded_at)}</span>
                            {b.evidence_sighted && <span>Evidence seen</span>}
                            {b.evidence_note && <span>{b.evidence_note}</span>}
                          </span>
                          {canAdminister && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12.5px]"
                              onClick={() => { setReasonText(""); setReasonFor({ person, action: "withdraw", basisId: b.id }); }}>
                              Withdraw
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Portal invitation and how delivery went. */}
                  {person.grant_state === "active" && (
                    <div className="flex flex-wrap items-center gap-3 px-5 pb-3 text-[13px] text-muted-foreground">
                      {delivery ? <Status label={delivery.label} tone={delivery.tone} /> : null}
                      <span>
                        {inviteState === "accepted"
                          ? `Invitation taken up ${formatDate(invite.accepted_at)}`
                          : inviteState === "expired"
                          ? "Invitation expired"
                          : inviteState === "withdrawn"
                          ? "Invitation withdrawn"
                          : invite?.first_opened_at
                          ? `Invitation opened ${formatDate(invite.first_opened_at)}`
                          : invite
                          ? `Invitation sent to ${invite.destination ?? "their email"}`
                          : "No invitation sent yet"}
                        {invite?.delivery_error && (
                          <span className="block">Delivery problem: {invite.delivery_error}</span>
                        )}
                      </span>
                      {canAdminister && inviteState !== "accepted" && inviteState !== "withdrawn" && (
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => void sendInvitation(person, Boolean(invite && invite.delivery_status !== "sent"))}>
                          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                          {invite ? "Send again" : "Send invitation"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </MuSection>

      {/* Record a reason for access */}
      <CareSheet
        open={Boolean(basisFor)}
        onOpenChange={(o) => !o && setBasisFor(null)}
        title="Record the reason for access"
        description={`${basisFor?.person_name ?? ""}. Clinical and finance access are refused without this.`}
        onSave={() => void recordBasis()}
        saveLabel="Record reason"
        saving={busy}
      >
        <CareFormRow label="Reason">
          <Select value={basisDraft.kind} onValueChange={(v) => setBasisDraft((d) => ({ ...d, kind: v }))}>
            <SelectTrigger id="basis-kind" className="h-11"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
            <SelectContent>
              {BASIS_KINDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CareFormRow>
        <CareFormRow label="Evidence">
          <input id="basis-note" className={cxInputClass()} value={basisDraft.note}
            onChange={(e) => setBasisDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Court order dated 4 March" />
        </CareFormRow>
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={basisDraft.sighted}
            onCheckedChange={(v) => setBasisDraft((d) => ({ ...d, sighted: v === true }))} />
          Evidence seen
        </label>
      </CareSheet>

      {/* Give or change access */}
      <CareSheet
        open={Boolean(grantFor)}
        onOpenChange={(o) => !o && setGrantFor(null)}
        title={grantPerson?.grant_id ? "Change access" : "Give access"}
        description={`${grantPerson?.person_name ?? ""}. Access applies to this client only.`}
        onSave={() => void saveGrant()}
        saveLabel="Save access"
        saving={busy}
      >
        <label className="flex items-start gap-2 text-sm text-ink">
          <Checkbox checked={grantDraft.journey}
            onCheckedChange={(v) => setGrantDraft((d) => ({ ...d, journey: v === true }))} />
          <span>
            Journey
            <span className="block text-[13px] text-body">Where the arrangement has got to.</span>
          </span>
        </label>

        <CareFormRow
          label="Care plan"
          help={clinicalOptions.length === 0 ? "Record a reason for access first." : undefined}
        >
          <Select value={grantDraft.clinicalBasis}
            onValueChange={(v) => setGrantDraft((d) => ({ ...d, clinicalBasis: v }))}>
            <SelectTrigger id="clinical-basis" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No care plan access</SelectItem>
              {clinicalOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>{BASIS_LABEL[b.basis_kind] ?? b.basis_kind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CareFormRow>

        <CareFormRow
          label="Invoices and payments"
          help={financeOptions.length === 0 ? "Record a finance participant reason first." : undefined}
        >
          <Select value={grantDraft.financeBasis}
            onValueChange={(v) => setGrantDraft((d) => ({ ...d, financeBasis: v }))}>
            <SelectTrigger id="finance-basis" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No finance access</SelectItem>
              {financeOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>Finance participant</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CareFormRow>

        <CareFormRow label="Reason for this decision">
          <textarea id="grant-reason" className={cn(cxInputClass(), "min-h-[96px]")} value={grantDraft.reason}
            onChange={(e) => setGrantDraft((d) => ({ ...d, reason: e.target.value }))} />
        </CareFormRow>
      </CareSheet>

      {/* Anything that needs a written reason */}
      <CareConfirm
        open={Boolean(reasonFor)}
        onOpenChange={(o) => !o && setReasonFor(null)}
        title={
          reasonFor?.action === "withdraw" ? "Withdraw the reason for access"
            : reasonFor?.action === "suspend" ? "Suspend access"
            : reasonFor?.action === "reactivate" ? "Reopen access"
            : "Revoke access"
        }
        description={`${reasonFor?.person.person_name ?? ""}. This is recorded on the client record.`}
        confirmLabel="Confirm"
        confirmDisabled={busy}
        keepLabel="Cancel"
        onConfirm={() => void runReason()}
      >
        <textarea className={cn(cxInputClass(), "min-h-[90px]")} value={reasonText}
          onChange={(e) => setReasonText(e.target.value)} aria-label="Reason" placeholder="Reason" />
      </CareConfirm>

    </div>
  );
};

export default AccessSection;
