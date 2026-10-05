import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MuEmpty, MuSection } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import ConsoleTable, { type ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { SelectField, Status } from "@/components/field";
import { adminDb } from "@/lib/admin-utils";
import { formatDate } from "@/lib/format";
import {
  DEMAND_STATES, MARKET_STATES, SAFETY_STATES, label, marketTone,
} from "@/lib/seo-registry";

interface MarketRow {
  id: string;
  country_code: string;
  state_name: string | null;
  city_name: string | null;
  lga_name: string | null;
  market_key: string;
  market_state: string;
  demand_state: string;
  safety_state: string;
  notes: string | null;
  evidence_as_of: string | null;
}

const COLUMNS: ConsoleColumn[] = [
  { key: "market", label: "Market", width: "22%" },
  { key: "country", label: "Country", width: "10%" },
  { key: "state", label: "State", width: "13%" },
  { key: "city", label: "City", width: "12%" },
  { key: "lga", label: "LGA", width: "12%" },
  { key: "demand", label: "Demand", width: "10%" },
  { key: "market_state", label: "Market", width: "11%" },
  { key: "safety", label: "Safety", width: "10%" },
];

const emptyDraft = {
  market_key: "",
  country_code: "NG",
  state_name: "",
  city_name: "",
  lga_name: "",
  market_state: "research",
  demand_state: "unknown",
  safety_state: "review",
  evidence_as_of: "",
  notes: "",
};

const SeoMarketsRegister = () => {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MarketRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("seo_markets")
      .select("id, country_code, state_name, city_name, lga_name, market_key, market_state, demand_state, safety_state, notes, evidence_as_of")
      .order("market_key");
    if (error) toast.error("Could not load markets");
    setLoadError(Boolean(error));
    setRows((data ?? []) as MarketRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openMarket = (row: MarketRow) => {
    setEditing(row);
    setDraft({
      market_key: row.market_key,
      country_code: row.country_code,
      state_name: row.state_name ?? "",
      city_name: row.city_name ?? "",
      lga_name: row.lga_name ?? "",
      market_state: row.market_state,
      demand_state: row.demand_state,
      safety_state: row.safety_state,
      evidence_as_of: row.evidence_as_of?.slice(0, 10) ?? "",
      notes: row.notes ?? "",
    });
  };

  const save = async () => {
    if (!draft.market_key.trim()) {
      toast.error("A market key is required");
      return;
    }
    const payload = {
      market_key: draft.market_key.trim(),
      country_code: draft.country_code.trim() || "NG",
      state_name: draft.state_name.trim() || null,
      city_name: draft.city_name.trim() || null,
      lga_name: draft.lga_name.trim() || null,
      market_state: draft.market_state,
      demand_state: draft.demand_state,
      safety_state: draft.safety_state,
      evidence_as_of: draft.evidence_as_of || null,
      notes: draft.notes.trim() || null,
      last_reviewed_at: new Date().toISOString(),
    };
    setSaving(true);
    const { error } = await adminDb().rpc("seo_market_save", {
      p_market_id: editing?.id ?? null,
      p_patch: payload,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Market saved" : "Market added");
    setEditing(null);
    setCreating(false);
    setDraft(emptyDraft);
    void load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="button" className="h-10" onClick={() => { setDraft(emptyDraft); setCreating(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> New market
        </Button>
      </div>

      {loadError ? (
        <MuSection padded={false}>
          <MuEmpty
            title="Could not load markets"
            description="The register did not load. Try again in a moment."
            action={<Button type="button" variant="outline" onClick={() => void load()}>Try again</Button>}
          />
        </MuSection>
      ) : rows.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty art={art.objMapPinHome} title="No markets yet" description="Add a market to record its demand, safety and evidence." />
        </MuSection>
      ) : (
      <>
      <ConsoleTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        renderRow={(row) => (
          <>
            <td className="border-r border-line-soft px-3 py-3 align-middle">
              <button type="button" onClick={() => openMarket(row)} className="text-left text-sm font-semibold text-navy hover:underline">
                {row.market_key}
              </button>
              <span className="mt-0.5 block text-xs text-muted-copy">
                {row.evidence_as_of ? `Evidence ${formatDate(row.evidence_as_of)}` : "No evidence date"}
              </span>
            </td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.country_code}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.state_name ?? "Not set"}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.city_name ?? "Not set"}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.lga_name ?? "Not set"}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{label(row.demand_state)}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={label(row.market_state)} tone={marketTone(row.market_state)} /></td>
            <td className="px-3 py-3 align-middle">{label(row.safety_state)}</td>
          </>
        )}
      />
      <ConsoleMobileList
        emptyLabel="No markets"
        rows={rows.map((row) => ({
          key: row.id,
          title: row.market_key,
          state: `${[row.city_name, row.state_name, row.country_code].filter(Boolean).join(", ")}. Demand ${label(row.demand_state).toLowerCase()}, safety ${label(row.safety_state).toLowerCase()}`,
          status: <Status label={label(row.market_state)} tone={marketTone(row.market_state)} />,
          onOpen: () => openMarket(row),
        }))}
      />
      </>
      )}

      <Dialog open={Boolean(editing) || creating} onOpenChange={(next) => { if (!next) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Market" : "New market"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="market-key">Market key</Label>
              <Input id="market-key" value={draft.market_key} onChange={(event) => setDraft({ ...draft, market_key: event.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="market-country">Country</Label>
                <Input id="market-country" value={draft.country_code} onChange={(event) => setDraft({ ...draft, country_code: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="market-state-name">State</Label>
                <Input id="market-state-name" value={draft.state_name} onChange={(event) => setDraft({ ...draft, state_name: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="market-city">City</Label>
                <Input id="market-city" value={draft.city_name} onChange={(event) => setDraft({ ...draft, city_name: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="market-lga">LGA</Label>
                <Input id="market-lga" value={draft.lga_name} onChange={(event) => setDraft({ ...draft, lga_name: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SelectField
                label="Demand"
                value={draft.demand_state}
                onChange={(value) => { if (value) setDraft({ ...draft, demand_state: value }); }}
                options={DEMAND_STATES.map((value) => ({ value, label: label(value) }))}
              />
              <SelectField
                label="Market state"
                value={draft.market_state}
                onChange={(value) => { if (value) setDraft({ ...draft, market_state: value }); }}
                options={MARKET_STATES.map((value) => ({ value, label: label(value) }))}
              />
              <SelectField
                label="Safety"
                value={draft.safety_state}
                onChange={(value) => { if (value) setDraft({ ...draft, safety_state: value }); }}
                options={SAFETY_STATES.map((value) => ({ value, label: label(value) }))}
              />
            </div>
            <div>
              <Label htmlFor="market-evidence">Evidence date</Label>
              <Input id="market-evidence" type="date" value={draft.evidence_as_of} onChange={(event) => setDraft({ ...draft, evidence_as_of: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="market-notes">Notes</Label>
              <Textarea id="market-notes" rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>Save market</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeoMarketsRegister;
