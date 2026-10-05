// Writing a role's contract once, then issuing it to everybody who took it.
//
// Terms says what is the same for everybody, what is only suggested, and what
// must be answered per person. Wording is the clause set. Annexes is the pack
// the role carries. Issue is the table: pick the people, fill the gaps that are
// theirs alone, and every contract is drafted and issued from the same source.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown, ArrowUp, CheckCircle2, ExternalLink, FileStack, Loader2, Plus, Save, Search, Send,
  Trash2, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import ContractDocument from "@/components/contracts/ContractDocument";
import { CONTRACT_FIELDS, ContractAnnex, ContractClause } from "@/lib/contracts";
import { issueAndSendContract } from "@/lib/contract-issue";
import {
  AnnexLibraryItem, CandidateRow, ContractTemplate, FIELD_RULE_LABELS, FieldRule, annexFromLibrary,
  createContractFromTemplate, deleteTemplate, loadAcceptedCandidates, loadAnnexLibrary,
  loadTemplate, saveTemplate, searchCandidates,
} from "@/lib/contract-templates";

interface RowState {
  person: CandidateRow;
  values: Record<string, string>;
  contractId?: string;
  state?: "drafted" | "issued" | "failed";
  error?: string;
}

const CONTRACT_TYPES = ["full_time", "part_time", "contract", "locum", "bank"];

const ContractTemplateEditor = () => {
  const { id = "" } = useParams();
  const { toast } = useToast();
  const { adminDisplayName } = useAuth();

  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [library, setLibrary] = useState<AnnexLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fields, setFields] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Record<string, FieldRule>>({});
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [annexes, setAnnexes] = useState<ContractAnnex[]>([]);
  const [meta, setMeta] = useState({
    name: "", description: "", contract_type: "full_time", job_title: "", department: "",
    is_clinical: false, active: true,
  });

  // Issue tab
  const [rows, setRows] = useState<RowState[]>([]);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CandidateRow[]>([]);
  const [accepted, setAccepted] = useState<CandidateRow[]>([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, lib, acc] = await Promise.all([
        loadTemplate(id), loadAnnexLibrary(), loadAcceptedCandidates().catch(() => []),
      ]);
      setTemplate(t);
      setLibrary(lib);
      setAccepted(acc);
      setFields(t.fields || {});
      setRules(t.field_rules || {});
      setClauses(t.clauses || []);
      setAnnexes(t.annexes || []);
      setMeta({
        name: t.name, description: t.description || "", contract_type: t.contract_type,
        job_title: t.job_title || "", department: t.department || "",
        is_clinical: t.is_clinical, active: t.active,
      });
    } catch (err: any) {
      toast({ title: "Could not open the template", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const asked = useMemo(
    () => Object.entries(rules).filter(([, r]) => r === "ask").map(([k]) => k),
    [rules],
  );

  const save = async () => {
    setSaving(true);
    try {
      await saveTemplate(id, {
        ...meta,
        description: meta.description || null,
        job_title: meta.job_title || null,
        department: meta.department || null,
        fields, field_rules: rules, clauses, annexes,
      });
      toast({ title: "Template saved" });
      load();
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const removeTemplate = async () => {
    if (!window.confirm("Delete this template? Contracts already drafted from it are unaffected.")) return;
    try {
      await deleteTemplate(id);
      window.location.href = "/admin/contracts/templates";
    } catch (err: any) {
      toast({ title: "Could not delete it", description: err.message, variant: "destructive" });
    }
  };

  /* ------------------------------------------------------------- annexes */

  const toggleAnnex = (code: string, include: boolean) =>
    setAnnexes((a) => a.map((x) => (x.code === code ? { ...x, include } : x)));

  const addFromLibrary = (item: AnnexLibraryItem) =>
    setAnnexes((a) => (a.some((x) => x.code === item.code) ? a : [...a, annexFromLibrary(item)]));

  const refreshAnnexWording = () =>
    setAnnexes((a) =>
      a.map((x) => {
        const lib = library.find((l) => l.code === (x.library_code || x.code));
        return lib ? { ...annexFromLibrary(lib), include: x.include, note: x.note ?? lib.note ?? undefined } : x;
      }),
    );

  /* -------------------------------------------------------------- people */

  const search = async (value: string) => {
    setTerm(value);
    try {
      setResults(await searchCandidates(value));
    } catch { /* the list simply stays as it was */ }
  };

  const addPerson = (p: CandidateRow) => {
    setRows((r) =>
      r.some((x) => x.person.id === p.id)
        ? r
        : [...r, {
            person: p,
            values: {
              employee_name: p.full_name || "",
              employee_email: p.email || "",
              ...Object.fromEntries(asked.map((k) => [k, ""])),
            },
          }],
    );
  };

  const setRowValue = (personId: string, key: string, value: string) =>
    setRows((r) => r.map((x) => (x.person.id === personId ? { ...x, values: { ...x.values, [key]: value } } : x)));

  const rowIncomplete = (row: RowState) => asked.some((k) => !(row.values[k] || "").trim());

  const run = async (issueToo: boolean) => {
    if (rows.length === 0) return;
    setRunning(true);
    const done: RowState[] = [];
    for (const row of rows) {
      if (row.state === "issued") { done.push(row); continue; }
      try {
        const merged = { ...fields, ...row.values };
        const contractId = row.contractId ?? await createContractFromTemplate(row.person.id, id, {
          fields: merged,
          job_title: merged.job_title || meta.job_title,
          contract_type: meta.contract_type,
          is_clinical: meta.is_clinical,
          notice_period: merged.notice_period,
          location: merged.primary_place_of_work,
          created_by_name: adminDisplayName,
        });
        let note: string | undefined;
        if (issueToo) {
          const result = await issueAndSendContract(contractId, adminDisplayName);
          if (!result.emailed) note = "Issued, email not sent";
        }
        done.push({ ...row, contractId, state: issueToo ? "issued" : "drafted", error: note });
      } catch (err: any) {
        done.push({ ...row, state: "failed", error: err.message });
      }
    }
    setRows(done);
    setRunning(false);
    const bad = done.filter((r) => r.state === "failed").length;
    toast({
      title: bad ? `${done.length - bad} done, ${bad} could not be completed` : issueToo ? "Contracts issued" : "Drafts created",
      variant: bad ? "destructive" : "default",
    });
  };

  if (loading) {
    return (
      <MuPage>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </MuPage>
    );
  }

  if (!template) {
    return (
      <MuPage>
        <MuSection><MuEmpty icon={FileStack} title="Template not found" /></MuSection>
      </MuPage>
    );
  }

  const previewFields = { ...fields, employee_name: fields.employee_name || "The employee" };

  return (
    <MuPage>
      <MuPageHeader
        title={meta.name}
        description={meta.description || "The contract for this role, written once."}
        backTo="/admin/contracts/templates"
        backLabel="All templates"
        actions={
          <>
            <Button variant="outline" asChild><Link to="/admin/contracts/annexes">Annex library</Link></Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
            </Button>
          </>
        }
      />

      <Tabs defaultValue="terms">
        <TabsList>
          <TabsTrigger value="terms">Terms</TabsTrigger>
          <TabsTrigger value="wording">Wording</TabsTrigger>
          <TabsTrigger value="annexes">Annexes</TabsTrigger>
          <TabsTrigger value="issue">Issue to people</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ terms */}
        <TabsContent value="terms" className="mt-4 space-y-5">
          <MuSection title="The role">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Template name</Label>
                <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Job title</Label>
                <Input value={meta.job_title} onChange={(e) => setMeta({ ...meta, job_title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={meta.department} onChange={(e) => setMeta({ ...meta, department: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Basis</Label>
                <Select value={meta.contract_type} onValueChange={(v) => setMeta({ ...meta, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>What this template is for</Label>
                <Input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border border-line p-3">
                <div>
                  <p className="text-[13px] font-medium">Clinical role</p>
                  <p className="text-xs text-muted-foreground">Carries the scope of practice annex.</p>
                </div>
                <Switch checked={meta.is_clinical} onCheckedChange={(v) => setMeta({ ...meta, is_clinical: v })} />
              </div>
              <div className="flex items-center justify-between border border-line p-3">
                <div>
                  <p className="text-[13px] font-medium">In use</p>
                  <p className="text-xs text-muted-foreground">Turn off to retire the template.</p>
                </div>
                <Switch checked={meta.active} onCheckedChange={(v) => setMeta({ ...meta, active: v })} />
              </div>
            </div>
          </MuSection>

          <MuSection
            title="The terms"
            description="Say how each term behaves. Same for everybody is written here once. Suggested is prefilled and editable per person. Ask each time must be answered before that person's contract can go out."
          >
            <div className="space-y-4">
              {CONTRACT_FIELDS.map((f) => {
                const rule = rules[f.key] || "fixed";
                return (
                  <div key={f.key} className="grid gap-3 border-b border-line-soft pb-4 last:border-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_200px]">
                    <div className="space-y-1.5">
                      <Label className="text-sm">{f.label}</Label>
                      {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                      {rule === "ask" ? (
                        <p className="text-[13px] italic text-muted-foreground">Answered per person on the issue table.</p>
                      ) : f.type === "textarea" ? (
                        <Textarea
                          rows={3}
                          value={fields[f.key] || ""}
                          onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          type={f.type === "date" ? "date" : "text"}
                          value={fields[f.key] || ""}
                          onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">How it behaves</Label>
                      <Select
                        value={rule}
                        onValueChange={(v) => setRules((p) => ({ ...p, [f.key]: v as FieldRule }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(FIELD_RULE_LABELS) as FieldRule[]).map((r) => (
                            <SelectItem key={r} value={r}>{FIELD_RULE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </MuSection>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={removeTemplate}>
              <Trash2 className="mr-2 h-4 w-4" />Delete this template
            </Button>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- wording */}
        <TabsContent value="wording" className="mt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <MuSection
              title="Clauses"
              description="The wording every contract from this template carries."
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setClauses((c) => [...c, {
                      key: `extra_${Date.now()}`, heading: "Additional term", body: "", section: "additional",
                    }])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />Add a term
                </Button>
              }
            >
              <div className="space-y-4">
                {clauses.map((c, i) => (
                  <div key={c.key} className="space-y-2 border border-line p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.heading}
                        onChange={(e) => setClauses((p) => p.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))}
                      />
                      <Button variant="ghost" size="icon" disabled={i === 0}
                        onClick={() => setClauses((p) => { const n = [...p]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={i === clauses.length - 1}
                        onClick={() => setClauses((p) => { const n = [...p]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive"
                        onClick={() => setClauses((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      rows={4}
                      className="font-mono text-[12.5px]"
                      value={c.body}
                      onChange={(e) => setClauses((p) => p.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                    />
                  </div>
                ))}
              </div>
            </MuSection>

            <MuSection title="How it reads" description="The document as anybody on this template will receive it.">
              <div className="max-h-[70vh] overflow-auto">
                <ContractDocument
                  fields={previewFields}
                  clauses={clauses}
                  annexes={annexes}
                  isClinical={meta.is_clinical}
                />
              </div>
            </MuSection>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- annexes */}
        <TabsContent value="annexes" className="mt-4 space-y-5">
          <MuSection
            title="The pack this role carries"
            description="Toggle what travels with the contract. The wording lives in the annex library."
            actions={
              <Button size="sm" variant="outline" onClick={refreshAnnexWording}>Refresh from the library</Button>
            }
          >
            <div className="space-y-3">
              {annexes.length === 0 && <p className="text-sm text-muted-foreground">No annexes on this template yet.</p>}
              {annexes.map((a) => (
                <div key={a.code} className="flex flex-wrap items-start gap-3 border border-line p-3">
                  <Switch checked={a.include !== false} onCheckedChange={(v) => toggleAnnex(a.code, v)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{a.code}: {a.title}</p>
                    <Input
                      className="mt-2"
                      placeholder="A line of explanation, printed under the title"
                      value={a.note || ""}
                      onChange={(e) => setAnnexes((p) => p.map((x) => (x.code === a.code ? { ...x, note: e.target.value } : x)))}
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.requires_signature && <MuStatus tone="warning" label="Signed by the person" />}
                      {a.clinical_only && <MuStatus tone="info" label="Clinical only" />}
                      {a.attachment_name && <MuStatus tone="neutral" label={`File: ${a.attachment_name}`} />}
                      {(a.body || "").trim() && <MuStatus tone="good" label="Prints with the contract" />}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive"
                    onClick={() => setAnnexes((p) => p.filter((x) => x.code !== a.code))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </MuSection>

          <MuSection title="Add from the library">
            <div className="flex flex-wrap gap-2">
              {library
                .filter((l) => !annexes.some((a) => a.code === l.code))
                .map((l) => (
                  <Button key={l.id} variant="outline" size="sm" onClick={() => addFromLibrary(l)}>
                    <Plus className="mr-2 h-4 w-4" />{l.code}: {l.title}
                  </Button>
                ))}
              {library.filter((l) => !annexes.some((a) => a.code === l.code)).length === 0 && (
                <p className="text-sm text-muted-foreground">Every annex in the library is already on this template.</p>
              )}
            </div>
          </MuSection>
        </TabsContent>

        {/* ------------------------------------------------------------ issue */}
        <TabsContent value="issue" className="mt-4 space-y-5">
          <MuSection title="Who is getting this contract" description="People who accepted an offer come first. Anybody else can be searched for.">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or email"
                  value={term}
                  onChange={(e) => search(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(term.trim().length >= 2 ? results : accepted).map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => addPerson(p)}>
                    <UserPlus className="mr-2 h-4 w-4" />{p.full_name || p.email}
                  </Button>
                ))}
                {term.trim().length < 2 && accepted.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nobody has accepted an offer yet. Search for a person instead.</p>
                )}
              </div>
            </div>
          </MuSection>

          <MuSection
            title="Check and issue"
            description={
              asked.length
                ? `Each person needs: ${asked.map((k) => CONTRACT_FIELDS.find((f) => f.key === k)?.label || k).join(", ")}.`
                : "Every term on this template is the same for everybody, so there is nothing left to fill in."
            }
            padded={false}
            actions={
              <>
                <Button size="sm" variant="outline" disabled={running || rows.length === 0} onClick={() => run(false)}>
                  {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create drafts
                </Button>
                <Button
                  size="sm"
                  disabled={running || rows.length === 0 || rows.some(rowIncomplete)}
                  onClick={() => run(true)}
                >
                  {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Create and issue
                </Button>
              </>
            }
          >
            {rows.length === 0 ? (
              <MuEmpty icon={UserPlus} title="Nobody chosen yet" description="Add the people this role was offered to." />
            ) : (
              <div className="divide-y divide-line-soft">
                {rows.map((row) => (
                  <div key={row.person.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-semibold">{row.person.full_name || "Unnamed"}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {[row.person.email, row.person.profession, row.person.city].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.state === "issued" && <MuStatus tone={row.error ? "warning" : "good"} label={row.error || "Issued and emailed"} />}
                        {row.state === "drafted" && <MuStatus tone="info" label="Draft created" />}
                        {row.state === "failed" && <MuStatus tone="bad" label={row.error || "Failed"} />}
                        {row.contractId && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/admin/contracts/${row.contractId}`}>
                              Open<ExternalLink className="ml-2 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon" className="text-destructive"
                          onClick={() => setRows((r) => r.filter((x) => x.person.id !== row.person.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {["employee_name", "employee_email", ...asked].map((key) => {
                        const def = CONTRACT_FIELDS.find((f) => f.key === key);
                        return (
                          <div key={key} className="space-y-1.5">
                            <Label className="text-xs">{def?.label || key}</Label>
                            {def?.type === "textarea" ? (
                              <Textarea
                                rows={2}
                                value={row.values[key] || ""}
                                onChange={(e) => setRowValue(row.person.id, key, e.target.value)}
                              />
                            ) : (
                              <Input
                                type={def?.type === "date" ? "date" : "text"}
                                value={row.values[key] || ""}
                                onChange={(e) => setRowValue(row.person.id, key, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {rowIncomplete(row) && (
                      <p className="text-xs text-destructive">
                        Something asked of this person is still blank, so their contract cannot go out yet.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </MuSection>

          {rows.some((r) => r.state === "issued") && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Each contract carries its own frozen copy of this wording. Changing the template later leaves them untouched.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </MuPage>
  );
};

export default ContractTemplateEditor;
