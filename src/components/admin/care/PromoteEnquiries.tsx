// Routing a website care request into Care.
//
// Every care request that has no care record is listed, newest first. The
// database creates the person, the household, the care request, the record and
// the contact in one step, so nothing is half made. Matching people are shown
// as a signal; staff decide what to attach and nothing attaches itself.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { adminDb } from "@/lib/admin-utils";
import { CLIENT_GROUPS } from "@/lib/care";
import { careErrorMessage } from "@/lib/care-errors";
import { convertEnquiry, enquiryMatches, type EnquiryMatch } from "@/lib/care-records";

interface Enquiry {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  service_line: string | null;
  city: string | null;
  created_at: string;
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  client_group: string | null;
  client_groups: string[] | null;
}

interface Choice {
  picked: boolean;
  serviceId: string;
  clientGroup: string;
  /** Empty means a new household. Otherwise the household of a matched person. */
  attachTo: string;
}

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const PromoteEnquiries = ({
  open,
  onOpenChange,
  services,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceRow[];
  onDone: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [matches, setMatches] = useState<Record<string, EnquiryMatch[]>>({});

  const read = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("contact_submissions")
      .select("id, name, email, phone, service_line, city, created_at")
      .is("care_client_id", null)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) { toast.error("Could not load care requests"); return; }

    const rows = (data ?? []) as Enquiry[];
    setEnquiries(rows);
    setChoices(
      Object.fromEntries(rows.map((e) => {
        const match = services.find((s) => s.slug === e.service_line);
        return [e.id, {
          picked: false,
          serviceId: match?.id ?? "",
          clientGroup: match?.client_group ?? match?.client_groups?.[0] ?? "adult",
          attachTo: "",
        }];
      })),
    );
  }, [services]);

  useEffect(() => { if (open) void read(); }, [open, read]);

  const update = (id: string, patch: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const pick = async (enquiry: Enquiry, picked: boolean) => {
    update(enquiry.id, { picked });
    if (!picked || matches[enquiry.id]) return;
    try {
      const found = await enquiryMatches(enquiry.id);
      setMatches((prev) => ({ ...prev, [enquiry.id]: found }));
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not check for matching people"));
    }
  };

  const chosen = enquiries.filter((e) => choices[e.id]?.picked);

  const route = async () => {
    if (chosen.length === 0) { toast.error("Choose the care requests to route"); return; }
    setSaving(true);
    let made = 0;
    let failed = 0;
    for (const enquiry of chosen) {
      const choice = choices[enquiry.id];
      const match = (matches[enquiry.id] ?? []).find((m) => m.person_id === choice.attachTo);
      try {
        await convertEnquiry({
          submissionId: enquiry.id,
          serviceId: choice.serviceId || null,
          clientGroup: choice.clientGroup || null,
          groupId: match?.group_id ?? null,
          personId: match?.person_id ?? null,
        });
        made += 1;
      } catch {
        failed += 1;
      }
    }
    setSaving(false);
    if (made > 0) {
      toast.success(made === 1 ? "One care record created" : `${made} care records created`);
    }
    if (failed > 0) {
      toast.error(failed === 1 ? "One care request could not be routed" : `${failed} care requests could not be routed`);
    }
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Care requests waiting to be routed</DialogTitle>
          <DialogDescription>
            These care requests have no care record. Nothing is created until you choose them and confirm.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading care requests</p>
        ) : enquiries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No care requests are waiting for a care record.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {enquiries.map((e) => {
              const choice = choices[e.id];
              if (!choice) return null;
              const found = matches[e.id] ?? [];
              return (
                <li key={e.id} className="flex flex-col gap-3 py-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={choice.picked}
                      onChange={(ev) => void pick(e, ev.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-semibold">{e.name ?? "Name not given"}</span>
                      <span className="mt-1 grid gap-x-6 gap-y-0.5 text-[13.5px] text-muted-foreground sm:grid-cols-2">
                        {e.email && <span>{e.email}</span>}
                        {e.phone && <span>{e.phone}</span>}
                        {e.city && <span>{e.city}</span>}
                        <span>Received {dateOf(e.created_at)}</span>
                      </span>
                    </span>
                  </label>
                  {choice.picked && (
                    <div className="grid gap-3 pl-7">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select value={choice.serviceId} onValueChange={(v) => update(e.id, { serviceId: v })}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Choose a service" /></SelectTrigger>
                          <SelectContent>
                            {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={choice.clientGroup} onValueChange={(v) => update(e.id, { clientGroup: v })}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CLIENT_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {found.length > 0 && (
                        <div className="grid gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            Matching people already on record
                          </span>
                          <Select value={choice.attachTo || "new"} onValueChange={(v) => update(e.id, { attachTo: v === "new" ? "" : v })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Create a new household</SelectItem>
                              {found.map((m) => (
                                <SelectItem key={m.person_id} value={m.person_id}>
                                  {`${m.full_name} · matched on ${m.matched_on === "email" ? "email" : "phone"}${m.group_name ? ` · ${m.group_name}` : ""}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => void route()} disabled={saving || chosen.length === 0}>
            {saving
              ? "Creating"
              : chosen.length === 0
                ? "Nothing chosen"
                : `Route ${chosen.length} care request${chosen.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PromoteEnquiries;
