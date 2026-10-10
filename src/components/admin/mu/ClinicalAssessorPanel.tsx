// Whether a person can carry out care needs assessments. Anyone with a sign-in
// can hold it, staff or a locum from the candidate pool; inactive staff cannot
// be assigned.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MuNote, MuSection } from "@/components/admin/mu/MuShell";
import { Status } from "@/components/field";
import { adminDb } from "@/lib/admin-utils";

interface Capability {
  active: boolean;
  eligible: boolean;
  has_account: boolean;
  staff_active: boolean;
  live_assessments: number;
}

const ClinicalAssessorPanel = ({ personId }: { personId: string }) => {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminDb().rpc("care_assessor_capability", { _person_id: personId });
    setCapability((data ?? null) as Capability | null);
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  const set = async (active: boolean) => {
    setSaving(true);
    const { error } = await adminDb().rpc("care_assessor_capability_set", {
      _person_id: personId, _active: active, _reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setReason("");
    await load();
    toast.success(active ? "Clinical assessor added" : "Clinical assessor removed");
  };

  return (
    <MuSection
      title="Clinical assessor"
      description="Clinical assessors can be assigned care needs assessments. Their work is reviewed by the clinical lead before it is used."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_220px] space-y-1.5">
            <Label htmlFor={`assessor-reason-${personId}`}>Reason</Label>
            <Input
              id={`assessor-reason-${personId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={capability?.active ? "Why this is being removed" : "Why this is being added"}
            />
          </div>
          <Button
            type="button"
            variant={capability?.active ? "outline" : "default"}
            className="h-10"
            disabled={saving || (!capability?.active && !capability?.has_account)}
            onClick={() => void set(!capability?.active)}
          >
            {capability?.active ? "Remove clinical assessor" : "Make clinical assessor"}
          </Button>
          <Status
            label={capability?.active ? "Clinical assessor" : "Not an assessor"}
            tone={capability?.active ? "good" : "neutral"}
          />
        </div>
        {capability?.active && capability.live_assessments > 0 && (
          <MuNote title="Reassign their visits first" tone="warning">
            {capability.live_assessments} assessment{capability.live_assessments === 1 ? " is" : "s are"} still assigned. Move them to another assessor before removing this.
          </MuNote>
        )}
        {capability?.active && !capability.eligible && (
          <MuNote title="Cannot be assigned at the moment" tone="warning">
            They need a sign-in, and staff need an active staff status.
          </MuNote>
        )}
        {!capability?.active && !capability?.has_account && (
          <MuNote title="Not eligible yet">
            Invite them to sign in first.
          </MuNote>
        )}
      </div>
    </MuSection>
  );
};

export default ClinicalAssessorPanel;
