// Whether a field carer can use the workforce app. Access needs all three: the
// person is in the Workforce, works in the field, and holds this capability.
// An assignment never grants access; it decides which care they see.
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
  has_account: boolean;
  workforce: boolean;
  field: boolean;
  app_access: boolean;
  live_assignments: number;
}

const CareWorkerPanel = ({ personId }: { personId: string }) => {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminDb().rpc("care_worker_capability", { _person_id: personId });
    setCapability((data ?? null) as Capability | null);
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  const set = async (active: boolean) => {
    setSaving(true);
    const { error } = await adminDb().rpc("care_worker_capability_set", {
      _person_id: personId, _active: active, _reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setReason("");
    await load();
    toast.success(active ? "Care worker added" : "Care worker removed");
  };

  // Admins without the workforce area get no data back; show nothing.
  if (!capability) return null;

  const missing = [
    !capability.has_account && "a sign-in",
    !capability.workforce && "to be in the Workforce",
    !capability.field && "their work setting set to field",
  ].filter(Boolean) as string[];

  return (
    <MuSection
      title="Care worker"
      description="Care workers can use the workforce app. They see only the care they are assigned to."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_220px] space-y-1.5">
            <Label htmlFor={`care-worker-reason-${personId}`}>Reason</Label>
            <Input
              id={`care-worker-reason-${personId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={capability.active ? "Why this is being removed" : "Why this is being added"}
            />
          </div>
          <Button
            type="button"
            variant={capability.active ? "outline" : "default"}
            className="h-10"
            disabled={saving || (!capability.active && missing.length > 0)}
            onClick={() => void set(!capability.active)}
          >
            {capability.active ? "Remove care worker" : "Make care worker"}
          </Button>
          <Status
            label={capability.app_access ? "Can use the app" : capability.active ? "Care worker, no app access" : "Not a care worker"}
            tone={capability.app_access ? "good" : capability.active ? "warning" : "neutral"}
          />
        </div>
        {capability.active && capability.live_assignments > 0 && (
          <MuNote title="End or reassign their care first" tone="warning">
            {capability.live_assignments} care assignment{capability.live_assignments === 1 ? " is" : "s are"} planned or active. End or reassign {capability.live_assignments === 1 ? "it" : "them"} before removing this.
          </MuNote>
        )}
        {missing.length > 0 && (
          <MuNote title={capability.active ? "App access is closed" : "Not eligible yet"} tone={capability.active ? "warning" : undefined}>
            They need {missing.join(", ")}.
          </MuNote>
        )}
      </div>
    </MuSection>
  );
};

export default CareWorkerPanel;
