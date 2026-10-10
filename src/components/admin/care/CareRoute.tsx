// How a client comes into care, and what must be on file before care starts.
//
// A standard route has a care needs assessment at home first. An urgent start,
// a one-off shift or visit, and staffing only start on the preliminary
// information alone. Some services always need the home assessment; for the
// rest, staff are asked once.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectField, Status } from "@/components/field";
import { MuSection } from "@/components/admin/mu/MuShell";
import { adminDb } from "@/lib/admin-utils";
import { careErrorMessage } from "@/lib/care-errors";

export type CareRouteId = "standard" | "urgent" | "one_off" | "staffing";

// How care starts when there is no home assessment first.
const START_KINDS: { id: Exclude<CareRouteId, "standard">; label: string; detail: string }[] = [
  { id: "urgent", label: "Urgent start", detail: "Care has to begin straight away." },
  { id: "one_off", label: "One-off", detail: "A single shift or visit." },
  { id: "staffing", label: "Staffing only", detail: "We provide staff for the family to manage." },
];

const PRELIMINARY: { key: string; label: string; help: string }[] = [
  { key: "where", label: "Address or hospital ward", help: "Where the carer goes on the first day." },
  { key: "allergies", label: "Allergies", help: "Write \"None known\" if there are none." },
  { key: "medicines", label: "Medicines", help: "Include any changes made in hospital." },
  { key: "risks", label: "Main risks", help: "For example falls, feeding, wandering or a recent operation." },
  { key: "emergency_contact", label: "Emergency contact and next of kin", help: "Name, relationship and phone number." },
];

type Preliminary = Record<string, string | boolean>;

const preliminaryComplete = (p: Preliminary | null | undefined) =>
  PRELIMINARY.every((f) => typeof p?.[f.key] === "string" && String(p?.[f.key]).trim() !== "") && p?.consent === true;

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

const CareRoute = ({
  clientId, route, startsAt, preliminary, serviceName, assessmentRequired, assessmentDecision, assessmentReason,
  canEdit, onChanged,
}: {
  clientId: string;
  route: CareRouteId | null;
  assessmentDecision: "needed" | "not_needed" | null;
  assessmentReason: string | null;
  startsAt: "home" | "hospital" | null;
  preliminary: Preliminary;
  serviceName: string | null;
  assessmentRequired: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) => {
  const [fee, setFee] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [noAssessment, setNoAssessment] = useState(false);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Preliminary>(preliminary);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(preliminary); }, [preliminary]);

  useEffect(() => {
    void (async () => {
      const { data } = await adminDb()
        .from("service_fees").select("amount_naira")
        .eq("fee_type", "assessment").eq("is_current", true).limit(1).maybeSingle();
      if (data?.amount_naira) setFee(Number(data.amount_naira));
    })();
  }, []);

  const feeText = fee ? naira(fee) : "the assessment fee";

  const setRoute = async (next: CareRouteId | null, where: "home" | "hospital" | null = startsAt) => {
    if (!next) return;
    setSaving(true);
    const { error } = await adminDb().rpc("care_client_route_set", {
      _client_id: clientId, _route: next, _starts_at: where,
    });
    setSaving(false);
    if (error) return toast.error(careErrorMessage(error, "Could not save how care starts"));
    toast.success("Saved");
    onChanged();
  };

  const decide = async (needed: boolean) => {
    if (!needed && !reason.trim()) return toast.error("Say why an assessment is not needed");
    setSaving(true);
    const { error } = await adminDb().rpc("care_client_assessment_decide", {
      _client_id: clientId, _needed: needed, _reason: needed ? null : reason.trim(),
    });
    setSaving(false);
    if (error) return toast.error(careErrorMessage(error, "Could not save the decision"));
    setChoosing(false);
    setNoAssessment(false);
    setReason("");
    toast.success(needed ? "Assessment needed" : "Assessment not needed");
    onChanged();
  };

  const savePreliminary = async () => {
    setSaving(true);
    const { error } = await adminDb().rpc("care_client_preliminary_save", {
      _client_id: clientId,
      _data: Object.fromEntries([
        ...PRELIMINARY.map((f) => [f.key, typeof draft[f.key] === "string" ? String(draft[f.key]).trim() : ""]),
        ["consent", draft.consent === true ? true : draft.consent === false ? false : null],
      ]),
    });
    setSaving(false);
    if (error) return toast.error(careErrorMessage(error, "Could not save the information"));
    toast.success("Saved");
    onChanged();
  };

  const recorded = PRELIMINARY.filter((f) => String(preliminary[f.key] ?? "").trim() !== "").length
    + (preliminary.consent === true ? 1 : 0);
  const total = PRELIMINARY.length + 1;
  const ready = preliminaryComplete(preliminary);
  const decided = assessmentDecision !== null;
  const showChoice = !decided || choosing;
  const startKind = START_KINDS.find((k) => k.id === route) ?? null;

  return (
    <MuSection
      title="Route into care"
      description="Whether a care needs assessment at home comes first, and how care starts."
      actions={decided && canEdit && !choosing ? (
        <Button type="button" variant="outline" className="h-10" onClick={() => setChoosing(true)}>Change</Button>
      ) : undefined}
    >
      <div className="grid gap-5">
        {decided && !choosing && (
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Status
                label={assessmentDecision === "needed" ? "Assessment at home needed" : "No assessment needed"}
                tone={assessmentDecision === "needed" ? "info" : "neutral"}
              />
              {assessmentDecision === "needed" && <span className="text-sm text-muted-copy">{feeText}</span>}
            </div>
            {assessmentDecision === "not_needed" && assessmentReason && (
              <p className="text-sm text-muted-copy">Reason: {assessmentReason}</p>
            )}
          </div>
        )}

        {showChoice && canEdit && (
          <div className="grid gap-3">
            {!noAssessment ? (
              <>
                <p className="text-sm font-semibold text-ink">Does this client need a care needs assessment at home?</p>
                {assessmentRequired && (
                  <p className="text-sm text-muted-copy">{serviceName ?? "This service"} usually has one.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="h-11" disabled={saving} onClick={() => void decide(true)}>
                    Yes, {feeText}
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => setNoAssessment(true)}>
                    No, not needed
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <label htmlFor="no-assessment-reason" className="text-sm font-semibold text-ink">
                  Why is an assessment not needed?
                </label>
                <Textarea
                  id="no-assessment-reason"
                  rows={2}
                  value={reason}
                  placeholder="For example: the baby is born by surrogacy and the nanny starts at the hospital."
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="h-11" disabled={saving || !reason.trim()} onClick={() => void decide(false)}>
                    Save
                  </Button>
                  <Button type="button" variant="ghost" className="h-11" onClick={() => setNoAssessment(false)}>
                    Back
                  </Button>
                </div>
              </div>
            )}
            {choosing && (
              <div>
                <Button type="button" variant="outline" className="h-10" onClick={() => { setChoosing(false); setNoAssessment(false); }}>
                  Keep as it is
                </Button>
              </div>
            )}
          </div>
        )}

        {assessmentDecision === "not_needed" && (
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-ink">Is this any of these? (optional)</p>
            <div className="flex flex-wrap gap-2">
              {START_KINDS.map((k) => (
                <Button
                  key={k.id}
                  type="button"
                  variant={startKind?.id === k.id ? "default" : "outline"}
                  className="h-10"
                  disabled={!canEdit || saving}
                  title={k.detail}
                  onClick={() => void setRoute(k.id)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {decided && (
          <div className="max-w-xs">
            <SelectField
              label="Where care begins"
              value={startsAt ?? ""}
              placeholder="Not decided"
              disabled={!canEdit || saving || !route}
              onChange={(v) => { if (v) void setRoute(route, v as "home" | "hospital"); }}
              options={[{ value: "home", label: "At home" }, { value: "hospital", label: "In hospital, then home" }]}
            />
          </div>
        )}

        <div className="grid gap-3 border-t border-line-soft pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-bold text-navy">Before care starts</p>
            <Status
              label={ready ? "Ready to start" : `${recorded} of ${total} recorded`}
              tone={ready ? "good" : "warning"}
            />
          </div>
          <p className="text-sm text-muted-copy">
            Needed on every route.
            {assessmentDecision === "needed" ? " With an assessment, the accepted assessment and the care plan come first too." : ""}
          </p>
          {PRELIMINARY.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <label htmlFor={`prelim-${f.key}`} className="text-[13.5px] font-semibold text-foreground">{f.label}</label>
              <Textarea
                id={`prelim-${f.key}`}
                rows={2}
                disabled={!canEdit}
                value={typeof draft[f.key] === "string" ? String(draft[f.key]) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
              <span className="text-xs text-muted-copy">{f.help}</span>
            </div>
          ))}
          <div className="max-w-xs">
            <SelectField
              label="Consent to care recorded"
              value={draft.consent === true ? "yes" : draft.consent === false ? "no" : ""}
              placeholder="Not asked yet"
              disabled={!canEdit}
              onChange={(v) => setDraft((d) => ({ ...d, consent: v === "yes" ? true : v === "no" ? false : "" }))}
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
            />
          </div>
          {canEdit && (
            <div>
              <Button type="button" className="h-11" disabled={saving} onClick={() => void savePreliminary()}>
                {saving ? "Saving" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </MuSection>
  );
};

export default CareRoute;
