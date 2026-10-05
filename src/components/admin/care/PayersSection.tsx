// Who pays for this care record. A payer is a person or an organisation (an
// employer, an HMO, a church), and several can share the cost; the shares add
// up to 100. Paying gives no access: an organisation's billing contact is
// given finance access on the Access tab, like anyone else.
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cxInputClass } from "@/components/candidate/primitives";
import { MuEmpty, MuRow, MuSection } from "@/components/admin/mu/MuShell";
import { CareField as CareFormRow, CareSheet } from "@/components/admin/care/CareSurface";
import { SearchableSelect } from "@/components/field";
import { careErrorMessage } from "@/lib/care-errors";
import {
  addOrganisationPerson, ORGANISATION_KINDS, payersOverview, saveOrganisation, setPayers,
  type PayersOverview,
} from "@/lib/care-records";

interface Draft { key: string; choice: string; share: string }

const NEW_ORG = { name: "", kind: "employer", billingEmail: "", contactName: "", contactEmail: "" };

const PayersSection = ({ clientId }: { clientId: string }) => {
  const [data, setData] = useState<PayersOverview | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [newOrg, setNewOrg] = useState<typeof NEW_ORG | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await payersOverview(clientId));
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not load the payers"));
    }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  if (!data) return null;

  const options = [
    ...data.people.map((p) => ({ value: `p:${p.id}`, label: p.full_name })),
    ...data.organisations.map((o) => ({ value: `o:${o.id}`, label: `${o.name}, ${ORGANISATION_KINDS[o.kind] ?? o.kind}` })),
  ];
  const total = rows.reduce((sum, r) => sum + (Number(r.share) || 0), 0);
  const chosen = rows.map((r) => r.choice).filter(Boolean);
  const complete = rows.length > 0 && rows.every((r) => r.choice && Number(r.share) > 0)
    && new Set(chosen).size === chosen.length && Math.abs(total - 100) < 0.001;

  const open = () => {
    setRows(data.payers.length > 0
      ? data.payers.map((p, i) => ({
          key: String(i),
          choice: p.person ? `p:${p.person.id}` : `o:${p.organisation?.id}`,
          share: String(Number(p.share_percent)),
        }))
      : [{ key: "0", choice: "", share: "100" }]);
    setNewOrg(null);
    setEditing(true);
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await setPayers(clientId, rows.map((r) => {
        const [kind, id] = r.choice.split(":");
        return kind === "p" ? { person_id: id, share_percent: Number(r.share) } : { organisation_id: id, share_percent: Number(r.share) };
      }));
      toast.success("Payers saved");
      setEditing(false);
      await load();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not save the payers"));
    } finally {
      setSaving(false);
    }
  };

  const createOrganisation = async () => {
    if (!newOrg || !newOrg.name.trim()) return;
    try {
      const id = await saveOrganisation({ name: newOrg.name.trim(), kind: newOrg.kind, billingEmail: newOrg.billingEmail });
      if (newOrg.contactName.trim()) await addOrganisationPerson(id, newOrg.contactName.trim(), newOrg.contactEmail);
      await load();
      setRows((list) => {
        const empty = list.find((r) => !r.choice);
        return empty
          ? list.map((r) => (r === empty ? { ...r, choice: `o:${id}` } : r))
          : [...list, { key: String(Date.now()), choice: `o:${id}`, share: "" }];
      });
      setNewOrg(null);
      toast.success(`${newOrg.name.trim()} added`);
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not add the organisation"));
    }
  };

  return (
    <MuSection
      title="Payers"
      description="Who pays, and what share. Paying gives no access; give a billing contact finance access on the Access tab."
      actions={
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={open}>
          {data.payers.length > 0 ? "Change payers" : "Add a payer"}
        </Button>
      }
    >
      {data.payers.length === 0 ? (
        <MuEmpty title="No payer recorded" />
      ) : (
        <div className="divide-y divide-line-soft">
          {data.payers.map((p) => (
            <MuRow
              key={p.id}
              title={p.person?.full_name ?? p.organisation?.name ?? "Payer"}
              state={
                p.organisation
                  ? [
                      ORGANISATION_KINDS[p.organisation.kind] ?? p.organisation.kind,
                      p.organisation.people.length > 0
                        ? `Billing: ${p.organisation.people.map((x) => x.full_name).join(", ")}`
                        : p.organisation.billing_email ?? "No billing contact yet",
                    ].join(". ")
                  : [p.person?.email, p.person?.phone].filter(Boolean).join(", ") || undefined
              }
              status={<span className="text-[14px] font-bold text-ink">{Number(p.share_percent)}%</span>}
            />
          ))}
        </div>
      )}

      <CareSheet
        open={editing}
        onOpenChange={setEditing}
        title="Payers"
        description="Pick each payer and their share. The shares must add up to 100."
        onSave={save}
        saving={saving}
        saveDisabled={!complete}
      >
        {rows.map((r) => (
          <div key={r.key} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SearchableSelect
                label="Payer"
                value={r.choice}
                onChange={(v) => update(r.key, { choice: v })}
                options={options}
                placeholder="Choose a person or organisation"
              />
            </div>
            <div className="w-24">
              <CareFormRow label="Share %">
                <input
                  className={cxInputClass()}
                  inputMode="decimal"
                  value={r.share}
                  onChange={(e) => update(r.key, { share: e.target.value.replace(/[^0-9.]/g, "") })}
                />
              </CareFormRow>
            </div>
            {rows.length > 1 && (
              <Button
                type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Remove this payer"
                onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <p className={`text-[13.5px] ${Math.abs(total - 100) < 0.001 ? "text-body" : "font-bold text-destructive"}`}>
          Shares add up to {total}%{Math.abs(total - 100) < 0.001 ? "." : ". They need to add up to 100."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9"
            onClick={() => setRows((list) => [...list, { key: String(Date.now()), choice: "", share: "" }])}>
            <Plus className="mr-1 h-4 w-4" /> Another payer
          </Button>
          {!newOrg && (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setNewOrg({ ...NEW_ORG })}>
              New organisation
            </Button>
          )}
        </div>

        {newOrg && (
          <div className="flex flex-col gap-3 border border-line-soft p-3">
            <p className="text-[14px] font-bold text-ink">New organisation</p>
            <CareFormRow label="Name">
              <input className={cxInputClass()} value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
            </CareFormRow>
            <SearchableSelect
              label="Kind"
              value={newOrg.kind}
              onChange={(v) => setNewOrg({ ...newOrg, kind: v })}
              options={Object.entries(ORGANISATION_KINDS).map(([value, label]) => ({ value, label }))}
            />
            <CareFormRow label="Billing email">
              <input className={cxInputClass()} type="email" value={newOrg.billingEmail} onChange={(e) => setNewOrg({ ...newOrg, billingEmail: e.target.value })} />
            </CareFormRow>
            <CareFormRow label="Billing contact" help="The person who receives invoices. Optional.">
              <input className={cxInputClass()} value={newOrg.contactName} onChange={(e) => setNewOrg({ ...newOrg, contactName: e.target.value })} />
            </CareFormRow>
            {newOrg.contactName.trim() && (
              <CareFormRow label="Billing contact email">
                <input className={cxInputClass()} type="email" value={newOrg.contactEmail} onChange={(e) => setNewOrg({ ...newOrg, contactEmail: e.target.value })} />
              </CareFormRow>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-9" disabled={!newOrg.name.trim()} onClick={() => void createOrganisation()}>
                Add organisation
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setNewOrg(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </CareSheet>
    </MuSection>
  );
};

export default PayersSection;
