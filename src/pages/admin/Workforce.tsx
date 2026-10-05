// Workforce: the internal staff register.
//
// This is not the candidate pool. Everybody listed here is employed or engaged by
// us, and the only questions this screen answers are the compliance ones: who
// works here, what are they on, and is their paperwork complete.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase, FileSignature, FileWarning, Loader2, Plus, Search, ShieldCheck, UserPlus, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { StateSelect, LgaSelect } from "@/components/LocationSelect";
import {
  MuEmpty, MuPage, MuPageHeader, MuSection, MuStats, MuStatus, MuToolbar, MuTone,
} from "@/components/admin/mu/MuShell";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import {
  CONTRACT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, STAFF_STATUS_LABELS, StaffRow, loadStaff,
} from "@/lib/staff";

const contractTone = (s: string | null): MuTone =>
  s === "active" || s === "signed" ? "good" : s === "issued" ? "info" : s === "draft" ? "warning" : "bad";

const staffTone = (s: string): MuTone =>
  s === "active" ? "good" : s === "pending" ? "warning" : s === "on_notice" ? "info" : "neutral";

const blankForm = {
  full_name: "",
  work_email: "",
  email: "",
  phone: "",
  job_title: "",
  department: "",
  employment_type: "full_time",
  staff_start_date: "",
  state: "",
  lga: "",
};


// Note: StaffRow has no staff_end_date field, so "on notice / leaving" is
// derived only from staff_status (on_notice or exited) as the register
// currently exposes no separate leaving date to check.
type ViewId = "active" | "pending" | "compliance" | "contracts" | "leaving" | "all";

const matchesView = (r: StaffRow, view: ViewId): boolean => {
  switch (view) {
    case "active":
      return r.staff_status === "active";
    case "pending":
      return r.staff_status === "pending";
    case "compliance":
      return r.docs_missing > 0;
    case "contracts":
      return !r.contract_status || !["signed", "active"].includes(r.contract_status);
    case "leaving":
      return r.staff_status === "on_notice" || r.staff_status === "exited";
    case "all":
    default:
      return true;
  }
};

const Workforce = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewId>("active");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await loadStaff());
    } catch (err: any) {
      toast({ title: "Could not load the staff register", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewed = useMemo(() => rows.filter((r) => matchesView(r, view)), [rows, view]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return viewed;
    return viewed.filter((r) =>
      [r.full_name, r.job_title, r.department, r.email, r.work_email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [viewed, query]);

  const viewTabs = useMemo(() => {
    const counts: Record<ViewId, number> = {
      active: 0, pending: 0, compliance: 0, contracts: 0, leaving: 0, all: rows.length,
    };
    for (const r of rows) {
      if (matchesView(r, "active")) counts.active += 1;
      if (matchesView(r, "pending")) counts.pending += 1;
      if (matchesView(r, "compliance")) counts.compliance += 1;
      if (matchesView(r, "contracts")) counts.contracts += 1;
      if (matchesView(r, "leaving")) counts.leaving += 1;
    }
    return [
      { id: "active", label: "Active", count: counts.active },
      { id: "pending", label: "Pending onboarding", count: counts.pending },
      { id: "compliance", label: "Compliance action", count: counts.compliance },
      { id: "contracts", label: "Contracts outstanding", count: counts.contracts },
      { id: "leaving", label: "On notice / leaving", count: counts.leaving },
      { id: "all", label: "All", count: counts.all },
    ];
  }, [rows]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.staff_status === "active").length;
    const noContract = rows.filter((r) => !r.contract_status || !["signed", "active"].includes(r.contract_status)).length;
    const docGaps = rows.filter((r) => r.docs_missing > 0).length;
    return [
      { label: "On the register", value: rows.length, icon: Users, hint: "People employed or engaged by us" },
      { label: "Active", value: active, icon: ShieldCheck, hint: "Currently working" },
      {
        label: "Contract outstanding",
        value: noContract,
        icon: FileSignature,
        hint: "No signed contract on file",
        tone: (noContract > 0 ? "attention" : "default") as "attention" | "default",
      },
      {
        label: "Compliance documents outstanding",
        value: docGaps,
        icon: FileWarning,
        hint: "Required documents not accepted",
        tone: (docGaps > 0 ? "attention" : "default") as "attention" | "default",
      },
    ];
  }, [rows]);

  const addStaff = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "A name is needed", description: "Enter the person's full name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    // One person, one record. If this email or phone is already on the books,
    // open that record instead of making a second one.
    const email = (form.email.trim() || form.work_email.trim()).toLowerCase();
    const phoneDigits = form.phone.replace(/\D/g, "");
    const phoneKey = phoneDigits.length < 7 ? null : phoneDigits.startsWith("2340") ? `234${phoneDigits.slice(4)}` : phoneDigits.startsWith("234") ? phoneDigits : phoneDigits.startsWith("0") ? `234${phoneDigits.slice(1)}` : phoneDigits;
    const keys = [email && `email_key.eq.${email}`, phoneKey && `phone_key.eq.${phoneKey}`].filter(Boolean).join(",");
    if (keys) {
      const { data: existing, error: lookupError } = await adminDb().from("mu_people").select("id, full_name, is_staff").or(keys).limit(1);
      if (lookupError) {
        setSaving(false);
        toast({ title: "Could not check for an existing record", description: lookupError.message, variant: "destructive" });
        return;
      }
      if (existing?.length) {
        setSaving(false);
        const match = existing[0];
        toast({
          title: `${match.full_name} is already on our books`,
          description: match.is_staff
            ? "They already have a staff record. Open it from the register."
            : "They are in the Talent Pool. Open their profile and use Move to staff register once their contract is signed.",
          variant: "destructive",
        });
        return;
      }
    }
    const { error } = await adminDb().from("mu_people").insert({
      full_name: form.full_name.trim(),
      email: form.email.trim() || form.work_email.trim() || null,
      work_email: form.work_email.trim() || null,
      phone: form.phone.trim() || null,
      job_title: form.job_title.trim() || null,
      department: form.department.trim() || null,
      employment_type: form.employment_type,
      staff_start_date: form.staff_start_date || null,
      state: form.state || null,
      lga: form.lga || null,
      is_staff: true,
      staff_status: "pending",
      status: "active",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not add them", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Added to the register", description: `${form.full_name} now has a staff record.` });
    setForm(blankForm);
    setOpen(false);
    load();
  };

  return (
    <MuPage>
      <MuPageHeader
        title="Workforce"
        description="Internal staff, their contracts and their compliance documents."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/contracts/templates">Contract templates</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/contracts/annexes">Annex library</Link>
            </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add staff member</Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add a staff member</DialogTitle>
                <DialogDescription>
                  Creates the employment record only. Their sign-in comes later, once a contract has been signed
                  and you send the invitation.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Full name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Work email</Label>
                  <Input type="email" value={form.work_email} onChange={(e) => setForm({ ...form, work_email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Personal email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Job title</Label>
                  <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Employment type</Label>
                  <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={form.staff_start_date} onChange={(e) => setForm({ ...form, staff_start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <StateSelect value={form.state} onChange={(v) => setForm({ ...form, state: v, lga: "" })} />
                </div>
                <div className="space-y-1.5">
                  <Label>LGA</Label>
                  <LgaSelect state={form.state} value={form.lga} onChange={(v) => setForm({ ...form, lga: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addStaff} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Add to register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        }

      />

      <MuStats stats={stats} columns={4} />

      <ConsoleTabs tabs={viewTabs} active={view} onChange={(id) => setView(id as ViewId)} label="Workforce views" controls="workforce-register" />

      <MuToolbar>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, job title or department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </MuToolbar>

      <MuSection title="Staff register" padded={false} id="workforce-register">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <MuEmpty
            icon={Briefcase}
            title={rows.length === 0 ? "No staff members" : "No one matches this view"}
            description={
              rows.length === 0
                ? "Add someone directly, or convert a hired candidate once their contract has been signed."
                : "Try another view, or clear the search."
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/admin/workforce/${r.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.full_name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {[r.job_title, r.department, EMPLOYMENT_TYPE_LABELS[r.employment_type || ""] || r.employment_type]
                        .filter(Boolean)
                        .join(" · ") || "No job details"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MuStatus label={STAFF_STATUS_LABELS[r.staff_status] || r.staff_status} tone={staffTone(r.staff_status)} />
                    <MuStatus
                      icon={FileSignature}
                      label={r.contract_status ? CONTRACT_STATUS_LABELS[r.contract_status] : "No contract"}
                      tone={contractTone(r.contract_status)}
                    />
                    <MuStatus
                      icon={FileWarning}
                      label={r.docs_missing > 0 ? `${r.docs_missing} document${r.docs_missing === 1 ? "" : "s"} outstanding` : "Documents complete"}
                      tone={r.docs_missing > 0 ? "warning" : "good"}
                    />
                    {!r.auth_user_id && <MuStatus label="No account" tone="neutral" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </MuSection>
    </MuPage>
  );
};

export default Workforce;
