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

const CARE_ROUTES: { id: CareRouteId; label: string; detail: string }[] = [
  { id: "standard", label: "Standard", detail: "A care needs assessment at home, then the care plan." },
  { id: "urgent", label: "Urgent start", detail: "Care starts on the preliminary information." },
  { id: "one_off", label: "One-off", detail: "A single shift or visit, on the preliminary information." },
  { id: "staffing", label: "Staffing only", detail: "We provide staff; the preliminary information is enough." },
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
  clientId, route, startsAt, preliminary, serviceName, assessmentRequired, canEdit, onChanged,
}: {
  clientId: string;
  route: CareRouteId | null;
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

  const setRoute = async (next: CareRouteId, where: "home" | "hospital" | null = startsAt) => {
    setSaving(true);
    const { error } = await adminDb().rpc("care_client_route_set", {
      _client_id: clientId, _route: next, _starts_at: where,
    });
    setSaving(false);
    if (error) return toast.error(careErrorMessage(error, "Could not save the route"));
    setChoosing(false);
    setNoAssessment(false);
    toast.success("Route saved");
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
  const current = CARE_ROUTES.find((r) => r.id === route) ?? null;
  const showChoice = !current || choosing;

  return (
    <MuSection
      title="Route into care"
      description={current ? current.detail : "Decide how this client comes into care."}
      actions={current && canEdit && !choosing ? (
        <Button type="button" variant="outline" className="h-10" onClick={() => setChoosing(true)}>Change route</Button>
      ) : undefined}
    >
      <div className="grid gap-5">
        {current && !choosing && (
          <div className="flex flex-wrap items-center gap-2">
            <Status label={current.label} tone={current.id === "urgent" ? "warning" : "info"} />
            {current.id === "standard" && <span className="text-sm text-muted-copy">Care needs assessment at home, {feeText}</span>}
          </div>
        )}

        {showChoice && canEdit && (
          <div className="grid gap-3">
            {assessmentRequired && !noAssessment ? (
              <>
                <p className="text-sm text-ink">
                  {serviceName ?? "This service"} always has a care needs assessment at home first.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="h-11" disabled={saving} onClick={() => void setRoute("standard")}>
                    Confirm assessment at home, {feeText}
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => setNoAssessment(true)}>
                    Care must start before an assessment
                  </Button>
                </div>
              </>
            ) : !noAssessment ? (
              <>
                <p className="text-sm font-semibold text-ink">Does this client need a care needs assessment at home?</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="h-11" disabled={saving} onClick={() => void setRoute("standard")}>
                    Yes, {feeText}
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => setNoAssessment(true)}>
                    No
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink">How does care start?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CARE_ROUTES.filter((r) => r.id !== "standard").map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={saving}
                      onClick={() => void setRoute(r.id)}
                      className="border border-line bg-card p-4 text-left hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block text-[15px] font-bold text-navy">{r.label}</span>
                      <span className="mt-1 block text-sm text-muted-copy">{r.detail}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <Button type="button" variant="ghost" className="h-10 px-0 text-sm" onClick={() => setNoAssessment(false)}>
                    Back
                  </Button>
                </div>
              </>
            )}
            {choosing && (
              <div>
                <Button type="button" variant="outline" className="h-10" onClick={() => { setChoosing(false); setNoAssessment(false); }}>
                  Keep {current?.label ?? "the current route"}
                </Button>
              </div>
            )}
          </div>
        )}

        {current && (
          <div className="max-w-xs">
            <SelectField
              label="Care starts"
              value={startsAt ?? ""}
              placeholder="Not decided"
              disabled={!canEdit || saving}
              onChange={(v) => { if (v) void setRoute(current.id, v as "home" | "hospital"); }}
              options={[{ value: "home", label: "At home" }, { value: "hospital", label: "In hospital" }]}
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
            {current?.id === "standard" ? " The standard route also needs the accepted assessment and the care plan." : ""}
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
