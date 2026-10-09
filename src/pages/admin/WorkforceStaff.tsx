// One staff member: their employment details, their paperwork, their contract,
// and their access to the system.
//
// The rule that shapes this screen: a person becomes staff only once a contract
// has been signed, and gets a sign-in only after that. Everything below is
// arranged in that order so nobody can invite somebody into the admin centre
// on a handshake.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Ban, Briefcase, CalendarDays, FileSignature, KeyRound, Loader2, Mail, MapPin,
  Phone, Plus, Save, Send, ShieldCheck, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/field";
import { art } from "@/components/mc/art";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";
import { useAuth } from "@/contexts/AuthContext";
import DocumentsPanel from "@/components/admin/DocumentsPanel";
import { StateSelect, LgaSelect } from "@/components/LocationSelect";
import { humaniseTerm } from "@/lib/readable";
import { contractPayloadFromOffer, createContractFromLibrary } from "@/lib/contracts";
import {
  MuEmpty, MuField, MuFieldGrid, MuNote, MuPage, MuPageHeader, MuRecord, MuSection,
  MuStatus, MuTone,
} from "@/components/admin/mu/MuShell";
import {
  CONTRACT_STATUS_LABELS, Contract, EMPLOYMENT_TYPE_LABELS, EmergencyContact,
  PAY_FREQUENCIES, PAY_FREQUENCY_LABELS, STAFF_STATUS_LABELS,
   createContract, issueContract, loadContracts, loadEmergencyContacts, loadStaff, reportsBelow, setContractStatus,
  WORK_SETTING_LABELS, type StaffRow,
} from "@/lib/staff";

import AccessAreas from "@/components/admin/AccessAreas";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { returnToTalent } from "@/lib/lifecycle";
import { ACCESS_DELEGATE_PERMISSION } from "@/lib/admin-access";
import ClinicalAssessorPanel from "@/components/admin/mu/ClinicalAssessorPanel";

const contractTone = (s: string): MuTone =>
  s === "active" || s === "signed" ? "good" : s === "issued" ? "info" : s === "draft" ? "warning" : "bad";

const blankContract = {
  contract_type: "full_time",
  job_title: "",
  department: "",
  start_date: "",
  end_date: "",
  probation_end: "",
  notice_period: "",
  pay_amount: "",
  pay_currency: "NGN",
  pay_frequency: "monthly",
  working_pattern: "",
  location: "",
  document_url: "",
  notes: "",
};

const WorkforceStaff = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user, isSuperAdmin, adminDisplayName } = useAuth();

  const [person, setPerson] = useState<any>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [acceptedOffer, setAcceptedOffer] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  // Everyone on the register, for "reports to" and the people who report here.
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [tab, setTab] = useState("overview");

  const [draftOpen, setDraftOpen] = useState(false);
  const navigate = useNavigate();
  const [draft, setDraft] = useState(blankContract);
  const [savingDraft, setSavingDraft] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePerms, setInvitePerms] = useState<string[]>(["profile_only"]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const [contact, setContact] = useState({ name: "", relationship: "", phone: "", email: "", address: "" });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: p }, cs, ecs, { data: act }, { data: offers }] = await Promise.all([
      adminDb().from("mu_people").select("*").eq("id", id).maybeSingle(),
      loadContracts(id),
      loadEmergencyContacts(id),
      adminDb().from("mu_activity").select("*").eq("person_id", id).order("created_at", { ascending: false }).limit(50),
      adminDb().from("mu_offers").select("*").eq("person_id", id).eq("status", "accepted").eq("kind", "role").order("responded_at", { ascending: false }).limit(1),
    ]);
    setPerson(p);
    loadStaff().then(setStaff).catch(() => setStaff([]));
    setContracts(cs);
    setContacts(ecs);
    setActivity(act ?? []);
    setAcceptedOffer(offers?.[0] || null);
    if (p?.auth_user_id) {
      const { data: perm } = await adminDb()
        .from("admin_permissions")
        .select("*")
        .eq("user_id", p.auth_user_id)
        .maybeSingle();
      setAccess(perm);
    } else {
      setAccess(null);
    }
    setInviteEmail(p?.work_email || p?.email || "");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const signed = useMemo(
    () => contracts.some((c) => c.status === "signed" || c.status === "active"),
    [contracts],
  );
  const isSelf = !!person?.auth_user_id && person.auth_user_id === user?.id;

  const patchPerson = async (patch: Record<string, unknown>) => {
    setPerson((prev: any) => ({ ...prev, ...patch }));
  };

  const saveProfile = async () => {
    if (!person) return;
    setSavingProfile(true);
    const { error } = await adminDb()
      .from("mu_people")
      .update({
        full_name: person.full_name,
        work_email: person.work_email,
        email: person.email,
        phone: person.phone,
        job_title: person.job_title,
        department: person.department,
        employment_type: person.employment_type,
        staff_status: person.staff_status,
        staff_start_date: person.staff_start_date || null,
        staff_end_date: person.staff_end_date || null,
        work_setting: person.work_setting || null,
        reports_to: person.reports_to || null,
        state: person.state,
        lga: person.lga,
      })
      .eq("id", person.id);
    setSavingProfile(false);
    toast(
      error
        ? { title: "Could not save", description: error.message, variant: "destructive" }
        : { title: "Saved" },
    );
  };

  const addContact = async () => {
    if (!contact.name.trim() || !id) return;
    const { error } = await adminDb().from("mu_staff_emergency_contacts").insert({
      person_id: id,
      name: contact.name.trim(),
      relationship: contact.relationship || null,
      phone: contact.phone || null,
      email: contact.email || null,
      address: contact.address || null,
      is_next_of_kin: contacts.length === 0,
    });
    if (error) {
      toast({ title: "Could not save the contact", description: error.message, variant: "destructive" });
      return;
    }
    setContact({ name: "", relationship: "", phone: "", email: "", address: "" });
    load();
  };

  const saveDraft = async () => {
    if (!id) return;
    setSavingDraft(true);
    try {
      await createContract(id, draft);
      toast({ title: "Contract drafted", description: "Issue it when you are ready for them to sign." });
      setDraft(blankContract);
      setDraftOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Could not create the contract", description: err.message, variant: "destructive" });
    }
    setSavingDraft(false);
  };

  // A new contract starts as a copy of the clause library, prefilled with what
  // we already hold on this person, then opens in the document editor.
  const buildContract = async () => {
    if (!id || !person) return;
    try {
       const newId = await createContractFromLibrary(
         id,
         contractPayloadFromOffer(person, acceptedOffer || undefined, adminDisplayName),
       );
      navigate(`/admin/contracts/${newId}`);
    } catch (err: any) {
      toast({ title: "Could not start the contract", description: err.message, variant: "destructive" });
    }
  };

  const runContractAction = async (fn: () => Promise<void | string>, done: string) => {
    try {
      const said = await fn();
      toast({ title: typeof said === "string" && said ? said : done });
      load();
    } catch (err: any) {
      toast({ title: "That did not go through", description: err.message, variant: "destructive" });
    }
  };


  const sendInvite = async () => {
    if (!inviteEmail.trim() || !id) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-admin", {
        body: {
          email: inviteEmail.trim(),
          displayName: person?.full_name || inviteEmail.trim(),
          permissions: invitePerms,
          requiresBlogApproval: true,
          requiresCampaignApproval: true,
          personId: id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await adminDb().from("mu_people").update({ staff_status: "active", invited_at: new Date().toISOString() }).eq("id", id);
      toast(
        data?.granted
          ? { title: "Access granted", description: `${inviteEmail} keeps the sign-in they already have.` }
          : { title: "Invitation sent", description: `${inviteEmail} can now set a password.` },
      );
      setInviteOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Could not grant access", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  const savePerms = async (next: string[]) => {
    if (!access) return;
    const before: string[] = Array.isArray(access.permissions) ? access.permissions : [];
    setAccess({ ...access, permissions: next });
    const { error } = await adminDb()
      .from("admin_permissions")
      .update({ permissions: next, updated_at: new Date().toISOString() })
      .eq("id", access.id);
    if (error) {
      setAccess({ ...access, permissions: before });
      toast({ title: "Could not change access", description: error.message, variant: "destructive" });
      return;
    }
    // Logged like a change made from People and access, so every change is in one history.
    if (user) {
      await adminDb().from("admin_access_log").insert({
        actor_user_id: user.id,
        actor_email: user.email ?? "",
        target_user_id: access.user_id,
        target_email: access.email,
        action: "areas_changed",
        permissions_before: before,
        permissions_after: next,
        note: "Changed from the staff record",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!person) {
    return (
      <MuPage>
        <MuPageHeader backTo="/admin/workforce" backLabel="Workforce" title="Staff record" />
        <MuSection padded={false}>
          <MuEmpty art={art.objMagnifier} title="That staff record could not be found" description="It may have been removed, or the link is wrong." />
        </MuSection>
      </MuPage>
    );
  }

  return (
    <MuPage>
      <MuPageHeader
        backTo="/admin/workforce"
        backLabel="Workforce"
        title={person.full_name}
        description={[person.job_title, person.department].filter(Boolean).join(", ") || "No job details"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MuStatus label={STAFF_STATUS_LABELS[person.staff_status] || person.staff_status} tone={person.staff_status === "active" ? "good" : "warning"} />
            <MuStatus
              icon={FileSignature}
              label={signed ? "Contract signed" : "No signed contract"}
              tone={signed ? "good" : "warning"}
            />
            {person.auth_user_id
              ? <MuStatus icon={KeyRound} label="Has sign-in" tone="info" />
              : <MuStatus icon={KeyRound} label="No sign-in" tone="neutral" />}
            <ConfirmAction
              title={`Return ${person.full_name} to Talent?`}
              description={
                <>
                  <p>Their employment closes and they go back to the Talent Pool. Their sign-in, documents and history stay as they are.</p>
                  <p>Live assignments or contracts block this until they are resolved.</p>
                </>
              }
              confirmLabel="Return to Talent"
              destructive
              onConfirm={async () => {
                try {
                  await returnToTalent(person.id);
                  toast({ title: "Returned to Talent", description: "Employment closed. Their full history is unchanged." });
                  navigate(`/admin/match-universe/${person.id}`);
                } catch (err: any) {
                  toast({ title: "Could not return them to Talent", description: err.message, variant: "destructive" });
                }
              }}
              trigger={<Button size="sm" variant="outline">Return to Talent</Button>}
            />
          </div>
        }
      />

      <div className="sm:hidden">
        <label htmlFor="workforce-record-section" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Record section
        </label>
        <select
          id="workforce-record-section"
          aria-label="Record section"
          value={tab}
          onChange={(e) => setTab(e.target.value)}
          className="min-h-12 w-full border border-line bg-card px-3 text-sm text-foreground"
        >
          <option value="overview">Overview</option>
          <option value="documents">Documents</option>
          <option value="contract">Contract</option>
          <option value="access">Access</option>
          <option value="activity">Activity</option>
        </select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="hidden w-full justify-start overflow-x-auto sm:flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <MuSection
            title="Employment details"
            description="Personal details and credentials stay on their candidate profile."
            actions={
              <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={person.full_name || ""} onChange={(e) => patchPerson({ full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Work email</Label>
                <Input value={person.work_email || ""} onChange={(e) => patchPerson({ work_email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Personal email</Label>
                <Input value={person.email || ""} onChange={(e) => patchPerson({ email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={person.phone || ""} onChange={(e) => patchPerson({ phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Job title</Label>
                <Input value={person.job_title || ""} onChange={(e) => patchPerson({ job_title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={person.department || ""} onChange={(e) => patchPerson({ department: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <SelectField
                  label="Employment type"
                  value={person.employment_type || "full_time"}
                  onChange={(v) => v && patchPerson({ employment_type: v })}
                  options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <SelectField
                  label="Staff status"
                  value={person.staff_status || "pending"}
                  onChange={(v) => v && patchPerson({ staff_status: v })}
                  options={["pending", "active", "on_notice", ...(person.staff_status === "exited" ? ["exited"] : [])].map((k) => ({
                    value: k,
                    label: STAFF_STATUS_LABELS[k],
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <SelectField
                  label="Works in"
                  value={person.work_setting || ""}
                  onChange={(v) => patchPerson({ work_setting: v || null })}
                  placeholder="Not set"
                  options={Object.entries(WORK_SETTING_LABELS).map(([k, v]) => ({ value: k, label: k === "office" ? `${v} (back office)` : `${v} (shifts and visits)` }))}
                />
              </div>
              <div className="space-y-1.5">
                <SelectField
                  label="Reports to"
                  value={person.reports_to || ""}
                  onChange={(v) => patchPerson({ reports_to: v || null })}
                  placeholder="No one (top of the structure)"
                  options={[
                    ...staff
                      // Not themselves, and no one who already reports to them.
                      .filter((r) => r.id !== person.id && !reportsBelow(staff, person.id).has(r.id))
                      .filter((r) => r.staff_status !== "exited")
                      .map((r) => ({ value: r.id, label: [r.full_name, r.job_title].filter(Boolean).join(", ") })),
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={person.staff_start_date || ""} onChange={(e) => patchPerson({ staff_start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Leaving date</Label>
                <Input type="date" value={person.staff_end_date || ""} onChange={(e) => patchPerson({ staff_end_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <StateSelect value={person.state || ""} onChange={(v) => patchPerson({ state: v, lga: "" })} />
              </div>
              <div className="space-y-1.5">
                <Label>LGA</Label>
                <LgaSelect state={person.state || ""} value={person.lga || ""} onChange={(v) => patchPerson({ lga: v })} />
              </div>
            </div>
          </MuSection>

          {(() => {
            const team = staff.filter((r) => r.reports_to === person.id);
            if (team.length === 0) return null;
            return (
              <MuSection title="Reports to them" description="Changed from each person’s own record.">
                <ul className="divide-y divide-line-soft">
                  {team.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link to={`/admin/workforce/${r.id}`} className="min-w-0 truncate text-[14.5px] font-bold text-brand">{r.full_name}</Link>
                      <span className="shrink-0 text-[13px] text-muted-foreground">{r.job_title || "No job title"}</span>
                    </li>
                  ))}
                </ul>
              </MuSection>
            );
          })()}

          {id && <ClinicalAssessorPanel personId={id} />}

          <MuSection
            title="Emergency contacts"
            description="The first one recorded is next of kin."
            padded={false}
          >
            {contacts.length === 0 ? (
              <MuEmpty art={art.objPhoneHandset} title="No emergency contact on file" description="Add at least one before their first shift." />
            ) : (
              <div className="divide-y divide-line-soft">
                {contacts.map((c) => (
                  <MuRecord
                    key={c.id}
                    title={c.name}
                    subtitle={c.relationship || "Relationship not recorded"}
                    status={c.is_next_of_kin ? <MuStatus label="Next of kin" tone="info" /> : undefined}
                    fields={
                      <MuFieldGrid columns={3}>
                        <MuField label="Phone" icon={Phone} value={c.phone} />
                        <MuField label="Email" icon={Mail} value={c.email} />
                        <MuField label="Address" icon={MapPin} value={c.address} />
                      </MuFieldGrid>
                    }
                  />
                ))}
              </div>
            )}
            <div className="border-t border-line-soft p-5">
            <div className="grid gap-3 border-2 border-navy bg-tint/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label sm:col-span-2 xl:col-span-3">Add a contact</p>
              <Input placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              <Input placeholder="Relationship" value={contact.relationship} onChange={(e) => setContact({ ...contact, relationship: e.target.value })} />
              <Input placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              <Input placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              <Input placeholder="Address" className="xl:col-span-2" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} />
              <Button size="sm" variant="outline" onClick={addContact} disabled={!contact.name.trim()}>
                <Plus className="mr-2 h-4 w-4" />Add contact
              </Button>
            </div>
            </div>
          </MuSection>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        <TabsContent value="documents" className="mt-4 space-y-6">
          {isSelf ? (
            <MuNote title="Your own record" tone="warning" icon={ShieldCheck}>
              You cannot review or accept your own paperwork. Ask another admin to check these documents.
            </MuNote>
          ) : (
            <DocumentsPanel personId={person.id} personName={person.full_name} onChanged={load} />
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        <TabsContent value="contract" className="mt-4 space-y-6">
          <MuSection
            title="Contracts"
            description="Renewals and amendments stack here."
            padded={false}
            actions={
              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/match-universe/${id}?tab=hiring`)}>
                <FileSignature className="mr-2 h-4 w-4" />Offers and contracts on their profile
              </Button>
            }

          >
            {contracts.length === 0 ? (
              <MuEmpty
                art={art.objSignedContract}
                title="No contract on file"
                description="Draft one from their profile."
              />
            ) : (
              <div className="divide-y divide-line-soft">
                {contracts.map((c) => (
                  <MuRecord
                    key={c.id}
                    title={c.job_title || EMPLOYMENT_TYPE_LABELS[c.contract_type] || humaniseTerm(c.contract_type)}
                    subtitle={`Drafted ${format(new Date(c.created_at), "d MMM yyyy")}${c.created_by_name ? ` by ${c.created_by_name}` : ""}`}
                    status={<MuStatus label={CONTRACT_STATUS_LABELS[c.status] || c.status} tone={contractTone(c.status)} />}
                    fields={
                      <MuFieldGrid columns={4}>
                        <MuField label="Type" icon={Briefcase} value={EMPLOYMENT_TYPE_LABELS[c.contract_type] || humaniseTerm(c.contract_type)} />
                        <MuField label="Starts" icon={CalendarDays} value={c.start_date ? format(new Date(c.start_date), "d MMM yyyy") : null} />
                        <MuField label="Ends" icon={CalendarDays} value={c.end_date ? format(new Date(c.end_date), "d MMM yyyy") : "Open ended"} />
                        <MuField label="Probation ends" icon={CalendarDays} value={c.probation_end ? format(new Date(c.probation_end), "d MMM yyyy") : null} />
                        <MuField
                          label="Pay"
                          value={c.pay_amount ? `${c.pay_currency} ${Number(c.pay_amount).toLocaleString()} ${PAY_FREQUENCY_LABELS[c.pay_frequency]?.toLowerCase() || c.pay_frequency}` : null}
                        />
                        <MuField label="Notice period" value={c.notice_period} />
                        <MuField label="Working pattern" value={c.working_pattern} />
                        <MuField label="Location" icon={MapPin} value={c.location} />
                        <MuField label="Issued" value={c.issued_at ? format(new Date(c.issued_at), "d MMM yyyy") : null} />
                        <MuField
                          label="Signed"
                          value={c.signed_at ? `${format(new Date(c.signed_at), "d MMM yyyy")}${c.signed_name ? ` by ${c.signed_name}` : ""}` : null}
                        />
                      </MuFieldGrid>
                    }
                    notes={
                      <>
                        {c.notes && <MuNote title="Note">{c.notes}</MuNote>}
                        {c.document_url && (
                          <MuNote title="Contract document">
                            <a href={c.document_url} target="_blank" rel="noreferrer" className="text-primary underline">
                              Open the stored contract
                            </a>
                          </MuNote>
                        )}
                      </>
                    }
                    actions={
                      <>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/contracts/${c.id}`)}>
                          <FileSignature className="mr-2 h-4 w-4" />Open the document
                        </Button>
                        {c.status === "draft" && (
                           <Button size="sm" onClick={() => runContractAction(() => issueContract(c.id, adminDisplayName), "Contract issued")}>
                            <Send className="mr-2 h-4 w-4" />Issue for signature
                          </Button>
                        )}
                        {c.status === "signed" && (
                          <Button size="sm" asChild>
                            <Link to={`/admin/contracts/${c.id}`}>
                              <ShieldCheck className="mr-2 h-4 w-4" />Countersign
                            </Link>
                          </Button>
                        )}
                        {["draft", "issued"].includes(c.status) && (
                          <Button variant="outline" size="sm" onClick={() => runContractAction(() => setContractStatus(c.id, "withdrawn"), "Contract withdrawn")}>
                            <Ban className="mr-2 h-4 w-4" />Withdraw
                          </Button>
                        )}
                        {c.status === "active" && (
                          <Button variant="outline" size="sm" onClick={() => runContractAction(() => setContractStatus(c.id, "ended"), "Contract ended")}>
                            End contract
                          </Button>
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </MuSection>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        <TabsContent value="access" className="mt-4 space-y-6">
          {!access ? (
            <MuSection
              title="System access"
              description="One person, one sign-in."
            >
              <div className="space-y-4">
                {!signed && (
                  <MuNote title="Not ready to grant access" tone="warning" icon={FileSignature}>
                    Needs a signed contract. Draft and issue one on the Contract tab.
                  </MuNote>
                )}
                <Button disabled={!signed} onClick={() => setInviteOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />Give admin access
                </Button>
              </div>
            </MuSection>
          ) : (
            <MuSection
              title="System access"
              description="Full withdrawal, password resets and sign-outs are on Admin access."
            >
              <div className="space-y-4">
                <MuFieldGrid columns={3}>
                  <MuField label="Sign-in email" icon={Mail} value={access?.email} />
                  <MuField label="Display name" icon={UserCog} value={access?.display_name} />
                  <MuField
                    label="Access"
                    value={access?.is_active === false ? "Withdrawn" : "Active"}
                  />
                </MuFieldGrid>
                <AccessAreas
                  value={access?.permissions || []}
                  lockedKeys={isSuperAdmin ? [] : [ACCESS_DELEGATE_PERMISSION]}
                  onChange={(next) => savePerms(next)}
                />
              </div>
            </MuSection>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        <TabsContent value="activity" className="mt-4">
          <MuSection title="Activity" padded={false}>
            {activity.length === 0 ? (
              <MuEmpty art={art.objClipboard} title="Nothing recorded yet" description="Changes to this record will be listed here." />
            ) : (
              <div className="divide-y divide-line-soft">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm">{humaniseTerm(a.action)}</p>
                      {a.actor_name && <p className="text-xs text-muted-foreground">by {a.actor_name}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "d MMM yyyy, HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </MuSection>
        </TabsContent>
      </Tabs>

      {/* New contract ---------------------------------------------------- */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New contract</DialogTitle>
            <DialogDescription>
              Starts as a draft. Binding only once issued and signed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <SelectField
                label="Contract type"
                value={draft.contract_type}
                onChange={(v) => v && setDraft({ ...draft, contract_type: v })}
                options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Job title</Label>
              <Input value={draft.job_title} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Working pattern</Label>
              <Input placeholder="For example: Monday to Friday, 9 to 5" value={draft.working_pattern} onChange={(e) => setDraft({ ...draft, working_pattern: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End date (fixed term only)</Label>
              <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Probation ends</Label>
              <Input type="date" value={draft.probation_end} onChange={(e) => setDraft({ ...draft, probation_end: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notice period</Label>
              <Input placeholder="For example: one month" value={draft.notice_period} onChange={(e) => setDraft({ ...draft, notice_period: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pay</Label>
              <Input type="number" value={draft.pay_amount} onChange={(e) => setDraft({ ...draft, pay_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <SelectField
                label="Frequency"
                value={draft.pay_frequency}
                onChange={(v) => v && setDraft({ ...draft, pay_frequency: v })}
                options={PAY_FREQUENCIES.map((f) => ({ value: f, label: PAY_FREQUENCY_LABELS[f] }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Place of work</Label>
              <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Contract document link</Label>
              <Input placeholder="Paste a link to the signed or unsigned contract" value={draft.document_url} onChange={(e) => setDraft({ ...draft, document_url: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftOpen(false)}>Cancel</Button>
            <Button onClick={saveDraft} disabled={savingDraft}>
              {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite ---------------------------------------------------------- */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Give {person.full_name} admin access</DialogTitle>
            <DialogDescription>
              Choose the areas first. If this email already signs in, that account gains them; otherwise an invitation is sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email for sign-in</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Areas</Label>
              <AccessAreas
                value={invitePerms}
                onChange={setInvitePerms}
                lockedKeys={isSuperAdmin ? [] : [ACCESS_DELEGATE_PERMISSION]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={sendInvite} disabled={inviting}>
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default WorkforceStaff;
