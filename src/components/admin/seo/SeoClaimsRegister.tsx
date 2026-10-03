import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConsoleTable, { type ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Status } from "@/components/field";
import { adminDb } from "@/lib/admin-utils";
import { formatDate } from "@/lib/format";
import {
  CLAIM_STATES, CLAIM_TYPES, RISK_LEVELS, claimEffectiveState, claimTone, label, riskTone,
} from "@/lib/seo-registry";

interface ClaimRow {
  id: string;
  claim_code: string;
  claim_type: string;
  claim_text: string;
  evidence_type: string | null;
  evidence_reference: string | null;
  evidence_url: string | null;
  evidence_as_of: string | null;
  valid_from: string | null;
  valid_until: string | null;
  state: string;
  risk_level: string;
  seo_page_claims: Array<{ page_id: string; usage_key: string; seo_pages: { page_key: string } | null }>;
}

const COLUMNS: ConsoleColumn[] = [
  { key: "select", label: "", width: "4%" },
  { key: "claim", label: "Claim", width: "24%" },
  { key: "type", label: "Type", width: "12%" },
  { key: "state", label: "State", width: "11%" },
  { key: "risk", label: "Risk", width: "9%" },
  { key: "evidence", label: "Evidence", width: "14%" },
  { key: "as_of", label: "Evidence date", width: "10%" },
  { key: "expiry", label: "Expiry", width: "9%" },
  { key: "used", label: "Where used", width: "9%" },
];

const emptyDraft = {
  claim_code: "",
  claim_type: "operating_fact",
  claim_text: "",
  evidence_type: "",
  evidence_reference: "",
  evidence_url: "",
  evidence_as_of: "",
  valid_until: "",
  state: "draft",
  risk_level: "medium",
};

const SeoClaimsRegister = () => {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClaimRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const approveSelected = async () => {
    const targets = rows.filter((row) => selected.has(row.id) && row.state !== "approved");
    if (targets.length === 0) {
      toast.error("No unapproved claims selected");
      return;
    }
    setApproving(true);
    let failed = 0;
    for (const row of targets) {
      const { error } = await adminDb().rpc("seo_claim_save", {
        p_claim_id: row.id,
        p_patch: { state: "approved", approved_at: new Date().toISOString() },
      });
      if (error) failed += 1;
    }
    setApproving(false);
    setSelected(new Set());
    if (failed > 0) toast.error(`${failed} of ${targets.length} claims could not be approved`);
    else toast.success(`${targets.length} claims approved`);
    void load();
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("seo_claims")
      .select("id, claim_code, claim_type, claim_text, evidence_type, evidence_reference, evidence_url, evidence_as_of, valid_from, valid_until, state, risk_level, seo_page_claims(page_id, usage_key, seo_pages(page_key))")
      .order("claim_code");
    if (error) toast.error("Could not load claims");
    setRows((data ?? []) as ClaimRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const effective = useMemo(
    () => new Map(rows.map((row) => [row.id, claimEffectiveState(row.state, row.valid_from, row.valid_until)])),
    [rows],
  );

  const openClaim = (row: ClaimRow) => {
    setEditing(row);
    setDraft({
      claim_code: row.claim_code,
      claim_type: row.claim_type,
      claim_text: row.claim_text,
      evidence_type: row.evidence_type ?? "",
      evidence_reference: row.evidence_reference ?? "",
      evidence_url: row.evidence_url ?? "",
      evidence_as_of: row.evidence_as_of?.slice(0, 10) ?? "",
      valid_until: row.valid_until?.slice(0, 10) ?? "",
      state: row.state,
      risk_level: row.risk_level,
    });
  };

  const save = async () => {
    if (!draft.claim_code.trim() || !draft.claim_text.trim()) {
      toast.error("A claim code and claim text are required");
      return;
    }
    const payload = {
      claim_code: draft.claim_code.trim(),
      claim_type: draft.claim_type,
      claim_text: draft.claim_text.trim(),
      evidence_type: draft.evidence_type.trim() || null,
      evidence_reference: draft.evidence_reference.trim() || null,
      evidence_url: draft.evidence_url.trim() || null,
      evidence_as_of: draft.evidence_as_of || null,
      valid_until: draft.valid_until || null,
      state: draft.state,
      risk_level: draft.risk_level,
      approved_at: draft.state === "approved" ? new Date().toISOString() : null,
    };
    setSaving(true);
    const { error } = await adminDb().rpc("seo_claim_save", {
      p_claim_id: editing?.id ?? null,
      p_patch: payload,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Claim saved" : "Claim added");
    setEditing(null);
    setCreating(false);
    setDraft(emptyDraft);
    void load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const usedIn = (row: ClaimRow) => row.seo_page_claims?.length ?? 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => setSelected(new Set(rows.filter((row) => row.state !== "approved").map((row) => row.id)))}
        >
          Select unapproved
        </Button>
        {selected.size > 0 && (
          <>
            <Button type="button" variant="outline" className="h-10" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
            <Button type="button" className="h-10" onClick={approveSelected} disabled={approving}>
              Approve selected ({selected.size})
            </Button>
          </>
        )}
        <Button type="button" className="h-10" onClick={() => { setDraft(emptyDraft); setCreating(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> New claim
        </Button>
      </div>

      <ConsoleTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        renderRow={(row) => (
          <>
            <td className="border-r border-line-soft px-3 py-3 align-middle">
              <Checkbox
                checked={selected.has(row.id)}
                onCheckedChange={() => toggle(row.id)}
                aria-label={`Select ${row.claim_code}`}
              />
            </td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">
              <button type="button" onClick={() => openClaim(row)} className="text-left text-sm font-semibold text-navy hover:underline">
                {row.claim_text}
              </button>
              <span className="mt-0.5 block font-mono text-[11px] text-muted-copy">{row.claim_code}</span>
            </td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{label(row.claim_type)}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">
              <Status label={label(effective.get(row.id) ?? row.state)} tone={claimTone(effective.get(row.id) ?? row.state)} />
            </td>
            <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={label(row.risk_level)} tone={riskTone(row.risk_level)} /></td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.evidence_reference ?? row.evidence_type ?? "No evidence recorded"}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.evidence_as_of ? formatDate(row.evidence_as_of) : "Not recorded"}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.valid_until ? formatDate(row.valid_until) : "None"}</td>
            <td className="px-3 py-3 align-middle">{usedIn(row) === 0 ? "Not used" : `${usedIn(row)} pages`}</td>
          </>
        )}
      />
      <ConsoleMobileList
        emptyLabel="No claims"
        rows={rows.map((row) => ({
          key: row.id,
          title: row.claim_text,
          state: `${label(row.claim_type)} · ${row.valid_until ? `Expires ${formatDate(row.valid_until)}` : "No expiry"} · ${usedIn(row) === 0 ? "Not used" : `${usedIn(row)} pages`}`,
          status: <Status label={label(effective.get(row.id) ?? row.state)} tone={claimTone(effective.get(row.id) ?? row.state)} />,
          onOpen: () => openClaim(row),
        }))}
      />

      <Dialog open={Boolean(editing) || creating} onOpenChange={(next) => { if (!next) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Claim" : "New claim"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="claim-code">Claim code</Label>
              <Input id="claim-code" value={draft.claim_code} onChange={(event) => setDraft({ ...draft, claim_code: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="claim-text">Claim</Label>
              <Textarea id="claim-text" rows={3} value={draft.claim_text} onChange={(event) => setDraft({ ...draft, claim_text: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="claim-type">Type</Label>
              <Select value={draft.claim_type} onValueChange={(value) => setDraft({ ...draft, claim_type: value })}>
                <SelectTrigger id="claim-type"><SelectValue /></SelectTrigger>
                <SelectContent>{CLAIM_TYPES.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="claim-state">State</Label>
                <Select value={draft.state} onValueChange={(value) => setDraft({ ...draft, state: value })}>
                  <SelectTrigger id="claim-state"><SelectValue /></SelectTrigger>
                  <SelectContent>{CLAIM_STATES.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="claim-risk">Risk</Label>
                <Select value={draft.risk_level} onValueChange={(value) => setDraft({ ...draft, risk_level: value })}>
                  <SelectTrigger id="claim-risk"><SelectValue /></SelectTrigger>
                  <SelectContent>{RISK_LEVELS.map((value) => <SelectItem key={value} value={value}>{label(value)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="claim-evidence-type">Evidence type</Label>
              <Input id="claim-evidence-type" value={draft.evidence_type} onChange={(event) => setDraft({ ...draft, evidence_type: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="claim-evidence-ref">Evidence reference</Label>
              <Input id="claim-evidence-ref" value={draft.evidence_reference} onChange={(event) => setDraft({ ...draft, evidence_reference: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="claim-evidence-url">Evidence link</Label>
              <Input id="claim-evidence-url" value={draft.evidence_url} onChange={(event) => setDraft({ ...draft, evidence_url: event.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="claim-as-of">Evidence date</Label>
                <Input id="claim-as-of" type="date" value={draft.evidence_as_of} onChange={(event) => setDraft({ ...draft, evidence_as_of: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="claim-until">Expiry</Label>
                <Input id="claim-until" type="date" value={draft.valid_until} onChange={(event) => setDraft({ ...draft, valid_until: event.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>Save claim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeoClaimsRegister;
