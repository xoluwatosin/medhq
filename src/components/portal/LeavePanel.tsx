// Leave, for people who are actually working with us.
//
// Approved leave shows on the availability calendar as time off, so we never
// offer a shift on a day we have already agreed to.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PortalEmpty, PortalSection } from "@/components/portal/PortalShell";
import { CalendarOff, Loader2, Plus } from "lucide-react";
import {
  type Engagement, type LeaveRequest, LEAVE_STATUS_LABEL, dateLabel,
} from "@/lib/offers";

const LeavePanel = ({ personId, onChanged }: { personId: string; onChanged?: () => void }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: e }, { data: l }] = await Promise.all([
      supabase.from("mu_engagements" as any).select("*").eq("person_id", personId).order("start_date", { ascending: false }),
      supabase.from("mu_leave_requests" as any).select("*").eq("person_id", personId).order("from_date", { ascending: false }),
    ]);
    setEngagements(((e as any) || []) as Engagement[]);
    setLeave(((l as any) || []) as LeaveRequest[]);
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!from || !to) {
      toast({ title: "Pick both dates", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("mu_request_leave" as any, {
      _from: from, _to: to, _reason: reason.trim() || null,
    });
    setBusy(false);
    const res = data as any;
    if (error || res?.ok === false) {
      toast({ title: "Could not send that", description: res?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Leave requested", description: "We will come back to you." });
    setOpen(false); setFrom(""); setTo(""); setReason("");
    load();
    onChanged?.();
  };

  const withdraw = async (id: string) => {
    await supabase.rpc("mu_decide_leave" as any, { _id: id, _action: "withdraw", _note: null });
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  const active = engagements.filter((e) => e.status === "active");

  return (
    <div className="space-y-4">
      <PortalSection
        title="Your work with us"
        description="Roles you have accepted. While one is running you can ask for time off here."
        padded={false}
      >
        {engagements.length === 0 ? (
          <PortalEmpty
            icon={CalendarOff}
            title="No placement yet"
            description="Once you accept an ongoing role it will appear here, along with leave."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {engagements.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-base font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[e.pattern, e.location, `from ${dateLabel(e.start_date)}`].filter(Boolean).join(" · ")}
                    {e.end_date ? ` · ended ${dateLabel(e.end_date)}` : ""}
                  </p>
                </div>
                <Badge variant={e.status === "active" ? "default" : "outline"}>
                  {e.status === "active" ? "Running" : "Ended"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>

      <PortalSection
        title="Time off"
        description="Ask early where you can. Approved leave blocks those days on your calendar."
        padded={false}
        actions={
          active.length > 0 ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Request leave</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                <DialogHeader><DialogTitle>Request time off</DialogTitle></DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">First day off</Label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last day off</Label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason (optional)</Label>
                  <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={busy} onClick={submit}>
                    {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Send request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      >
        {leave.length === 0 ? (
          <PortalEmpty icon={CalendarOff} title="No leave requested" />
        ) : (
          <ul className="divide-y divide-border/60">
            {leave.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-base font-medium">
                    {dateLabel(l.from_date)} to {dateLabel(l.to_date)}
                  </p>
                  {l.reason && <p className="text-sm text-muted-foreground">{l.reason}</p>}
                  {l.decision_note && <p className="text-sm text-muted-foreground">Our note: {l.decision_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={l.status === "approved" ? "default" : l.status === "requested" ? "secondary" : "outline"}>
                    {LEAVE_STATUS_LABEL[l.status]}
                  </Badge>
                  {l.status === "requested" && (
                    <Button size="sm" variant="ghost" onClick={() => withdraw(l.id)}>Withdraw</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>
    </div>
  );
};

export default LeavePanel;
