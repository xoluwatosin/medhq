// Care clients. The real list, in the console treatment.
//
// Stage is derived in the database and shown here; nobody sets it. What a
// coordinator acts on is the next action, which comes from the work engine
// already ranked.
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, UserRoundPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useListParam, useRestoreListParams } from "@/hooks/useListParam";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { adminDb } from "@/lib/admin-utils";
import { CLIENT_GROUPS, createCarePerson, workKindLabel } from "@/lib/care";
import { careStageLabel, careStageTone } from "@/lib/care-status";
import {
  RELATIONSHIP_TERMS, STATE_TERMS, ageText, lgaTerms, stateLabel, lgaLabel,
} from "@/lib/care-vocabularies";
import { DateField, PhoneField, SearchableSelect, SelectField, Status } from "@/components/field";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { dueText, nextActions, needsAttention, workTone, type NextAction } from "@/lib/care-work";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";
import PromoteEnquiries from "@/components/admin/care/PromoteEnquiries";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import ConsoleTable, { ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import CareRequests from "@/pages/admin/CareRequests";

interface ClientRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  date_of_birth_is_estimated: boolean | null;
  state_code: string | null;
  lga_code: string | null;
  stage: string;
  created_at: string;
  archived_at: string | null;
  service: string;
  action: NextAction | null;
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  client_group: string | null;
  client_groups: string[] | null;
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// One Care list: the people, and the requests still being prepared, as views
// of the same list rather than two pages with two meanings of "attention".
const FILTERS = [
  { id: "attention", label: "Needs attention" },
  { id: "requests", label: "Requests" },
  { id: "awaiting", label: "Awaiting responses" },
  { id: "returned", label: "Responses returned" },
  { id: "booked", label: "Assessment booked" },
  { id: "running", label: "Care running" },
  { id: "paused", label: "Paused" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
  { id: "archived", label: "Archive" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const COLUMNS: ConsoleColumn[] = [
  { key: "client", label: "Client", width: "24%" },
  { key: "service", label: "Service", width: "18%" },
  { key: "status", label: "Status", width: "16%" },
  { key: "next", label: "Next action", width: "27%" },
  { key: "action", label: "Action", width: "15%" },
];

const elapsedLabel = (iso: string) => {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
};

const matchesFilter = (client: ClientRow, filter: FilterId) => {
  if (filter === "archived") return Boolean(client.archived_at);
  if (client.archived_at) return false;
  if (filter === "all") return true;
  if (filter === "attention") return needsAttention(client.action);
  if (filter === "awaiting") return client.stage === "awaiting_pre_assessment";
  if (filter === "returned") return client.stage === "pre_assessment_received";
  if (filter === "booked") return client.stage === "assessment_booked";
  if (filter === "paused") return client.stage === "paused";
  if (filter === "closed") return client.stage === "closed";
  if (filter === "requests") return false;
  return client.stage === "care_running";
};

const placeOf = (client: ClientRow) =>
  [
    ageText(client.date_of_birth, client.date_of_birth_is_estimated),
    client.lga_code ? lgaLabel(client.state_code, client.lga_code) : client.state_code ? stateLabel(client.state_code) : null,
  ]
    .filter((part) => part && part !== "Age not recorded")
    .join(", ");

const Clients = () => {
  const navigate = useNavigate();
  // The chosen view lives in the address bar and is remembered.
  useRestoreListParams();
  const [activeFilter, setActiveFilter] = useListParam<FilterId>("view", "attention");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createMode, setCreateMode] = useState<"choose" | "manual" | "link">("choose");
  const [onboardingLink, setOnboardingLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", preferred_name: "",
    date_of_birth: "", date_of_birth_is_estimated: false,
    state_code: "", lga_code: "", address_line: "",
    client_group: "adult", service_id: "",
    contact_first_name: "", contact_last_name: "", contact_relationship: "",
    contact_relationship_other: "", contact_phone: "", contact_email: "",
  });

  const load = async () => {
    setLoading(true);
    const [clientsRes, servicesRes, actionsRes] = await Promise.all([
      adminDb()
        .from("clients")
        .select(
          "id, full_name, preferred_name, date_of_birth, date_of_birth_is_estimated, state_code, lga_code, stage, created_at, archived_at, services(name)",
        )
        .order("created_at", { ascending: false }),
      adminDb().from("services").select("id, slug, name, client_group, client_groups").eq("is_offered", true).order("sort_order"),
      nextActions().catch(() => [] as NextAction[]),
    ]);

    if (clientsRes.error) toast.error("Could not load clients");
    setLoadFailed(Boolean(clientsRes.error));

    const actionByClient = new Map((actionsRes ?? []).map((a) => [a.client_id, a]));

    setClients(
      ((clientsRes.data ?? []) as unknown as (Omit<ClientRow, "service" | "action"> & { services: { name: string } | null })[]).map((c) => ({
        ...c,
        service: c.services?.name ?? "Not set",
        action: actionByClient.get(c.id) ?? null,
      })),
    );
    setServices((servicesRes.data ?? []) as ServiceRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visibleClients = useMemo(
    () => clients.filter((client) => matchesFilter(client, activeFilter)),
    [clients, activeFilter],
  );

  const tabs = useMemo(
    () => FILTERS.map((f) => ({ ...f, count: f.id === "requests" ? undefined : clients.filter((c) => matchesFilter(c, f.id)).length })),
    [clients],
  );

  const createClient = async () => {
    const clientName = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(" ");
    const contactName = [form.contact_first_name.trim(), form.contact_last_name.trim()].filter(Boolean).join(" ");
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Both parts of the client name are required");
      return;
    }
    if (!form.contact_first_name.trim() || !form.contact_last_name.trim() || !form.contact_phone.trim()) {
      toast.error("Contact name and phone are required");
      return;
    }
    if (!emailOk(form.contact_email.trim())) {
      toast.error("A valid contact email is required");
      return;
    }
    setSaving(true);
    const { data, error } = await adminDb()
      .from("clients")
      .insert({
        full_name: clientName,
        preferred_name: form.preferred_name.trim() || null,
        date_of_birth: form.date_of_birth || null,
        date_of_birth_is_estimated: form.date_of_birth ? form.date_of_birth_is_estimated : false,
        state_code: form.state_code || null,
        lga_code: form.lga_code || null,
        address_line: form.address_line.trim() || null,
        client_group: form.client_group,
        service_id: form.service_id || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error("Could not create client");
      return;
    }

    const personId = await createCarePerson(adminDb(), {
      full_name: contactName,
      email: form.contact_email.trim(),
      phone: form.contact_phone.trim(),
      whatsapp: form.contact_phone.trim(),
    });

    const { error: contactError } = await adminDb().from("client_contacts").insert({
      client_id: data.id,
      person_id: personId,
      full_name: contactName,
      relationship_code: form.contact_relationship || null,
      relationship_other:
        form.contact_relationship === "other" ? form.contact_relationship_other.trim() || null : null,
      phone: form.contact_phone.trim(),
      whatsapp: form.contact_phone.trim(),
      email: form.contact_email.trim(),
      is_primary: true,
      is_enquirer: true,
    });

    setSaving(false);
    if (contactError) toast.error("Client created, but the contact could not be saved");
    else toast.success("Client created");
    setOpen(false);
    navigate(`/admin/clients/${data.id}`);
  };

  const openCreate = (next: boolean) => {
    setOpen(next);
    if (next) { setCreateMode("choose"); setOnboardingLink(""); setCopied(false); }
  };

  const generateOnboardingLink = async () => {
    setSaving(true);
    const { data, error } = await adminDb().functions.invoke("care-onboarding-create", { body: { action: "create" } });
    setSaving(false);
    if (error || !data?.ok || !data.token) return toast.error(data?.error ?? "Could not generate the link");
    setOnboardingLink(`${window.location.origin}/care/start/${data.token}`);
  };

  const copyOnboardingLink = async () => {
    await navigator.clipboard.writeText(onboardingLink);
    setCopied(true);
    toast.success("Link copied");
  };

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const nextActionCell = (client: ClientRow) =>
    client.action ? (
      <>
        <Status
          label={`${workKindLabel(client.action.kind)}: ${client.action.rank_reason}`}
          tone={workTone(client.action)}
        />
        <span className="mt-1 block text-sm font-semibold text-ink">{client.action.title}</span>
        <span className="mt-0.5 block text-xs text-muted-copy">
          {[dueText(client.action.due_at), client.action.team ? `Owner: ${client.action.team}` : null]
            .filter(Boolean)
            .join(", ")}
        </span>
      </>
    ) : (
      <span className="text-sm text-muted-copy">No outstanding work</span>
    );

  return (
    <section className="mx-auto w-full max-w-[1080px]" aria-labelledby="clients-heading">
      <ConsolePageHeader
        id="clients-heading"
        title="Care"
        description="Everyone in care, and the requests still being prepared."
        action={
          <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => setSweepOpen(true)}>
            Route care requests
          </Button>
          <Dialog open={open} onOpenChange={openCreate}>
            <DialogTrigger asChild>
              <Button type="button" className="h-11">Add client</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{createMode === "manual" ? "Create client manually" : createMode === "link" ? "Generate client link" : "Add client"}</DialogTitle>
                <DialogDescription>{createMode === "link" ? "The person completes their details and continues directly to pre-assessment." : createMode === "manual" ? "Enter the person receiving care and the primary contact." : "Choose how the client record should begin."}</DialogDescription>
              </DialogHeader>
              {createMode === "choose" && <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setCreateMode("manual")} className="border border-line bg-card p-5 text-left hover:bg-tint/30"><UserRoundPlus className="h-6 w-6 text-navy" aria-hidden /><span className="mt-4 block text-[15px] font-bold text-navy">Create manually</span><span className="mt-1 block text-sm text-muted-copy">Enter the person and contact details now.</span></button>
                <button type="button" onClick={() => setCreateMode("link")} className="border border-line bg-card p-5 text-left hover:bg-tint/30"><Link2 className="h-6 w-6 text-navy" aria-hidden /><span className="mt-4 block text-[15px] font-bold text-navy">Generate link</span><span className="mt-1 block text-sm text-muted-copy">Collect their details, then open pre-assessment.</span></button>
              </div>}
              {createMode === "manual" && <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">First name</Label>
                    <Input id="first_name" value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Last name</Label>
                    <Input id="last_name" value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="preferred_name">Preferred name</Label>
                    <Input id="preferred_name" value={form.preferred_name} onChange={(e) => set("preferred_name")(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <DateField
                      label="Date of birth"
                      value={form.date_of_birth}
                      onChange={set("date_of_birth")}
                      help="Age is worked out from this."
                    />
                    <label className="flex items-center gap-2 text-[13.5px] text-muted-copy">
                      <Checkbox
                        checked={form.date_of_birth_is_estimated}
                        onCheckedChange={(v) =>
                          setForm((f) => ({ ...f, date_of_birth_is_estimated: v === true }))
                        }
                      />
                      This date is an estimate
                    </label>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <SearchableSelect
                    label="State"
                    value={form.state_code}
                    onChange={(v) => setForm((f) => ({ ...f, state_code: v, lga_code: "" }))}
                    options={STATE_TERMS.map((t) => ({ value: t.code, label: t.label }))}
                    placeholder="Choose a state"
                  />
                  <SearchableSelect
                    label="Local government area"
                    value={form.lga_code}
                    onChange={set("lga_code")}
                    options={lgaTerms(form.state_code).map((t) => ({ value: t.code, label: t.label }))}
                    disabled={!form.state_code}
                    disabledReason="Choose a state first"
                    placeholder="Choose an area"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <AddressAutocomplete
                    value={form.address_line}
                    onChange={set("address_line")}
                    placeholder="Start typing the address"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <SelectField
                    label="Client group"
                    value={form.client_group}
                    onChange={(v) => { if (v) set("client_group")(v); }}
                    options={CLIENT_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
                  />
                  <SelectField
                    label="Service"
                    value={form.service_id}
                    placeholder="Choose a service"
                    onChange={(v) => {
                      if (!v) return;
                      const picked = services.find((s) => s.id === v);
                      setForm((f) => ({
                        ...f,
                        service_id: v,
                        client_group: picked?.client_group ?? picked?.client_groups?.[0] ?? f.client_group,
                      }));
                    }}
                    options={services.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <div className="grid gap-4 border-2 border-navy bg-tint/40 p-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">Primary contact</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="contact_first_name">Contact first name</Label>
                      <Input id="contact_first_name" value={form.contact_first_name} onChange={(e) => set("contact_first_name")(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contact_last_name">Contact last name</Label>
                      <Input id="contact_last_name" value={form.contact_last_name} onChange={(e) => set("contact_last_name")(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <SearchableSelect
                      label="The contact is the client's"
                      value={form.contact_relationship}
                      onChange={set("contact_relationship")}
                      options={RELATIONSHIP_TERMS.map((t) => ({ value: t.code, label: t.label }))}
                      placeholder="Choose a relationship"
                    />
                    {form.contact_relationship === "other" && (
                      <Input
                        aria-label="Relationship"
                        value={form.contact_relationship_other}
                        onChange={(e) => set("contact_relationship_other")(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <PhoneField
                      label="Phone"
                      value={form.contact_phone}
                      onChange={({ e164, raw }) => set("contact_phone")(e164 ?? raw)}
                    />
                    <div className="grid gap-2">
                      <Label htmlFor="contact_email">Email</Label>
                      <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => set("contact_email")(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>}
              {createMode === "link" && <div className="grid gap-4">
                {!onboardingLink ? <div className="border-2 border-navy bg-tint/40 p-3"><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">About this link</p><ul className="mt-2 grid gap-1 text-sm text-ink"><li>No record until they confirm their details</li><li>Expires after 30 days</li><li>No family portal access</li></ul></div> : <div className="grid gap-2"><Label htmlFor="onboarding-link">Secure onboarding link</Label><div className="flex gap-2"><Input id="onboarding-link" readOnly value={onboardingLink} className="min-w-0"/><Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => void copyOnboardingLink()}>{copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}<span className="sr-only">Copy link</span></Button></div></div>}
              </div>}
              <DialogFooter className="gap-2">
                {createMode !== "choose" && <Button type="button" variant="outline" className="h-11" onClick={() => setCreateMode("choose")}>Back</Button>}
                {createMode === "manual" && <Button type="button" onClick={createClient} disabled={saving} className="h-11">{saving ? "Saving" : "Create client"}</Button>}
                {createMode === "link" && !onboardingLink && <Button type="button" onClick={() => void generateOnboardingLink()} disabled={saving} className="h-11">{saving ? "Generating" : "Generate secure link"}</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <PromoteEnquiries
        open={sweepOpen}
        onOpenChange={setSweepOpen}
        services={services}
        onDone={() => { void load(); }}
      />


      <ConsoleTabs
        tabs={tabs}
        active={activeFilter}
        onChange={(id) => setActiveFilter(id as FilterId)}
        label="Filter clients"
        controls="client-records"
      />

      <div id="client-records">
        {activeFilter === "requests" ? (
          <CareRequests embedded />
        ) : loading ? (
          <p className="py-10 text-center text-sm text-muted-copy">Loading clients</p>
        ) : loadFailed ? (
          <p className="border border-line bg-card px-5 py-10 text-center text-sm text-muted-copy">Clients could not be loaded. Refresh to try again.</p>
        ) : visibleClients.length === 0 ? (
          <div className="border border-line bg-card">
            <MuEmpty
              art={art.objCarePlan}
              title={activeFilter === "attention" ? "Nothing needs attention" : "No clients here"}
              description={activeFilter === "all" ? "Add a client or route care requests to start a record." : "Nothing in this view right now. Try another filter."}
            />
          </div>
        ) : (
          <>
            <ConsoleTable
              columns={COLUMNS}
              rows={visibleClients}
              rowKey={(client) => client.id}
              renderRow={(client) => (
                <>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">
                    <strong className="block text-sm font-semibold text-navy">{client.full_name}</strong>
                    <span className="mt-0.5 block text-xs text-muted-copy">
                      {placeOf(client) || "Details not set"}
                    </span>
                  </td>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">{client.service}</td>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">
                    <Status label={careStageLabel(client.stage)} tone={careStageTone(client.stage)} />
                    <span className="mt-1 block text-xs font-semibold text-muted-copy">{elapsedLabel(client.created_at)}</span>
                  </td>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">{nextActionCell(client)}</td>
                  <td className="px-3 py-2 align-middle">
                    <Button asChild type="button" variant="outline" size="sm" className="h-11 w-full border-line-soft bg-card px-2.5 text-xs text-navy">
                      <Link to={`/admin/clients/${client.id}`}>Open record</Link>
                    </Button>
                  </td>
                </>
              )}
            />

            <ConsoleMobileList
              emptyLabel="No clients"
              rows={visibleClients.map((client) => ({
                key: client.id,
                title: client.full_name,
                state: [client.service, placeOf(client) || "Details not set", elapsedLabel(client.created_at)].join(", "),
                status: <Status label={careStageLabel(client.stage)} tone={careStageTone(client.stage)} />,
                to: `/admin/clients/${client.id}`,
              }))}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default Clients;
