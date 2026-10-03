// Where each role application stands, and the two things the office does about
// it: move the stage, or offer interview times the candidate books themselves.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarPlus, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import {
  APPLICATION_STAGES, STAGE_LABEL, slotSentence,
  type ApplicationRecord,
} from "@/lib/applications";
import { MuEmpty, MuRow, MuSection, MuStatus } from "@/components/admin/mu/MuShell";

interface DraftSlot { date: string; time: string; duration: string; mode: string; location: string }

const emptySlot = (): DraftSlot => ({ date: "", time: "", duration: "30", mode: "video", location: "" });

const ApplicationStages = ({ personId, onChanged }: { personId: string; onChanged?: () => void }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [offering, setOffering] = useState<ApplicationRecord | null>(null);
  const [drafts, setDrafts] = useState<DraftSlot[]>([emptySlot()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (adminDb() as any).rpc("mu_applications_for_person", { _person_id: personId });
    setRows(((data as ApplicationRecord[]) || []).filter((r) => r.kind === "opportunity"));
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const setStage = async (row: ApplicationRecord, stage: string) => {
    setBusy(row.id);
    const { error } = await (adminDb() as any).rpc("mu_set_application_stage", {
      _application_id: row.id, _stage: stage, _note: null,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Stage not changed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Stage set to ${STAGE_LABEL[stage].toLowerCase()}` });
    load();
    onChanged?.();
  };

  const submitSlots = async () => {
    if (!offering) return;
    const slots = drafts
      .filter((d) => d.date && d.time)
      .map((d) => ({
        starts_at: new Date(`${d.date}T${d.time}`).toISOString(),
        duration_minutes: Number(d.duration) || 30,
        mode: d.mode,
        location: d.location || null,
      }));
    if (slots.length === 0) {
      toast({ title: "Add at least one time", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (adminDb() as any).rpc("mu_offer_interview_slots", {
      _application_id: offering.id, _slots: slots,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Times not offered", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: slots.length === 1 ? "One time offered" : `${slots.length} times offered`,
      description: "The candidate picks one in their own account.",
    });
    setOffering(null);
    setDrafts([emptySlot()]);
    load();
    onChanged?.();
  };

  if (loading) {
    return (
      <MuSection title="Role applications">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </MuSection>
    );
  }

  return (
    <>
      <MuSection
        title={rows.length === 1 ? "One role application" : `${rows.length} role applications`}
        description="The stage is what the candidate sees in their own account. Interview times are offered here and booked there."
        padded={false}
      >
        {rows.length === 0 && (
          <MuEmpty
            title="No role applications"
            description="This profile reached us through another route."
          />
        )}
        <div className="divide-y divide-line-soft">
          {rows.map((row) => {
            const booked = row.slots.find((s) => s.status === "booked");
            const offered = row.slots.filter((s) => s.status === "offered");
            const closed = row.stage === "not_taken_forward" || row.stage === "withdrawn";
            const sentence = booked
              ? `Interview booked for ${slotSentence(booked).replace(/\.$/, "")}`
              : offered.length > 0
                ? offered.length === 1
                  ? "One interview time is with the candidate to accept."
                  : `${offered.length} interview times are with the candidate to accept.`
                : [row.location, `Applied ${format(new Date(row.applied_at), "d MMM yyyy")}`]
                    .filter(Boolean).join(" · ");

            return (
              <MuRow
                key={row.id}
                title={row.title}
                state={sentence}
                status={
                  row.stage === "not_taken_forward" || row.stage === "withdrawn" ? (
                    <MuStatus tone="neutral" label="Closed" />
                  ) : row.stage === "offer_made" ? (
                    <MuStatus tone="good" label="Placed" />
                  ) : undefined
                }
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={row.stage}
                      disabled={busy === row.id}
                      onValueChange={(v) => setStage(row, v)}
                    >
                      <SelectTrigger className="h-8 w-[176px] rounded-none text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPLICATION_STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="text-[13px]">{STAGE_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!closed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-none"
                        onClick={() => { setOffering(row); setDrafts([emptySlot()]); }}
                      >
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                        Offer times
                      </Button>
                    )}
                    {row.opportunity_id && (
                      <Button size="sm" variant="ghost" className="h-8 rounded-none" asChild>
                        <Link to={`/admin/match-universe/opportunities/${row.opportunity_id}/applications`}>
                          Open role<ExternalLink className="ml-1.5 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      </MuSection>

      <Dialog open={!!offering} onOpenChange={(o) => !o && setOffering(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Offer interview times</DialogTitle>
            <DialogDescription>
              {offering?.title}. The candidate accepts one time and the rest are released.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {drafts.map((d, i) => (
              <div key={i} className="space-y-3 border border-line-soft p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Date</Label>
                    <Input
                      type="date" value={d.date} className="rounded-none"
                      onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Start time</Label>
                    <Input
                      type="time" value={d.time} className="rounded-none"
                      onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, time: e.target.value } : x))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Minutes</Label>
                    <Input
                      type="number" min={10} step={5} value={d.duration} className="rounded-none"
                      onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Held by</Label>
                    <Select
                      value={d.mode}
                      onValueChange={(v) => setDrafts(drafts.map((x, j) => j === i ? { ...x, mode: v } : x))}
                    >
                      <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video call</SelectItem>
                        <SelectItem value="phone">Telephone</SelectItem>
                        <SelectItem value="in_person">In person</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">
                    {d.mode === "in_person" ? "Address" : "Joining link"}
                  </Label>
                  <Input
                    value={d.location} className="rounded-none"
                    placeholder={d.mode === "in_person" ? "Where to attend" : "Link the candidate should use"}
                    onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, location: e.target.value } : x))}
                  />
                </div>
                {drafts.length > 1 && (
                  <Button
                    size="sm" variant="ghost" className="h-8 rounded-none"
                    onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove this time
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm" variant="outline" className="h-8 rounded-none"
              onClick={() => setDrafts([...drafts, emptySlot()])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />Add another time
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setOffering(null)}>Cancel</Button>
            <Button className="rounded-none" onClick={submitSlots} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Offer these times
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApplicationStages;
