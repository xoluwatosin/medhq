// The same human entered twice on the care side.
//
// Matches come from every route into care (request form, enquiry, admin), by
// email, phone, or name with date of birth. Nothing merges on its own:
// families share emails and phones. Staff answer "same person" or
// "different people", and a "different people" answer is remembered.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { careErrorMessage } from "@/lib/care-errors";
import { formatDate } from "@/lib/format";
import {
  dismissMatch, matchReason, mergePeople, personMatches, type MatchCard, type PersonMatch,
} from "@/lib/care-records";

const pairKey = (m: PersonMatch) => `${m.person_a.id}:${m.person_b.id}`;

const Side = ({ p, keeping, onKeep }: { p: MatchCard; keeping: boolean; onKeep: () => void }) => {
  const rows: [string, string][] = [
    ["Email", p.email ?? ""],
    ["Phone", p.phone ?? ""],
    ["WhatsApp", p.whatsapp && p.whatsapp !== p.phone ? p.whatsapp : ""],
    ["Families", p.families.map((f) => f.display_name).join(", ")],
    ["Sign-in", p.has_sign_in ? "Has a sign-in" : ""],
  ];
  return (
    <div className={`flex flex-col gap-3 border p-4 ${keeping ? "border-brand bg-brand-tint" : "border-line-soft"}`}>
      <div>
        <p className="text-[15px] font-bold text-ink">{p.full_name}</p>
        <p className="text-xs text-muted-copy">Added {formatDate(p.created_at)}</p>
      </div>
      <dl className="flex flex-col gap-1 text-[13.5px]">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-copy">{k}</dt>
            <dd className="min-w-0 truncate text-right text-body">{v}</dd>
          </div>
        ))}
      </dl>
      {(p.care_records.length > 0 || p.contact_for.length > 0) && (
        <ul className="flex flex-col gap-1 text-[13.5px]">
          {p.care_records.map((c) => (
            <li key={`r${c.client_id}`}>
              Receives care: <Link className="font-bold text-brand" to={`/admin/clients/${c.client_id}`}>{c.full_name}</Link>
              {c.enquiry_number ? `, ${c.enquiry_number}` : ""}
            </li>
          ))}
          {p.contact_for.map((c) => (
            <li key={`c${c.client_id}`}>
              Contact for <Link className="font-bold text-brand" to={`/admin/clients/${c.client_id}`}>{c.full_name}</Link>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" size="sm" variant={keeping ? "default" : "outline"} className="h-9" onClick={onKeep}>
        {keeping ? "Keeping this one" : "Keep this one"}
      </Button>
    </div>
  );
};

const CareDuplicates = () => {
  const [params] = useSearchParams();
  const clientId = params.get("client") ?? undefined;
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<PersonMatch[]>([]);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [combine, setCombine] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMatches(await personMatches(clientId));
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not load possible duplicates"));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const keptOf = (m: PersonMatch) => (keep[pairKey(m)] === m.person_b.id ? m.person_b : m.person_a);
  const droppedOf = (m: PersonMatch) => (keptOf(m).id === m.person_a.id ? m.person_b : m.person_a);
  const separateFamilies = (m: PersonMatch) => {
    const a = new Set(m.person_a.families.map((f) => f.id));
    return m.person_b.families.some((f) => !a.has(f.id)) && m.person_a.families.length > 0;
  };

  const merge = async (m: PersonMatch) => {
    const key = pairKey(m);
    const kept = keptOf(m);
    const dropped = droppedOf(m);
    setBusy(key);
    try {
      const result = await mergePeople(kept.id, dropped.id, !!combine[key] && separateFamilies(m));
      toast.success(
        result.families_combined > 0
          ? `${dropped.full_name} merged into ${kept.full_name}, and their families combined`
          : `${dropped.full_name} merged into ${kept.full_name}`,
      );
      await load();
    } catch (error) {
      toast.error(careErrorMessage(error, "Nothing was merged"));
    } finally {
      setBusy(null);
    }
  };

  const different = async (m: PersonMatch) => {
    setBusy(pairKey(m));
    try {
      await dismissMatch(m.person_a.id, m.person_b.id);
      toast.success("Marked as different people. They will not be offered again.");
      await load();
    } catch (error) {
      toast.error(careErrorMessage(error, "Could not save that"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1120px]" aria-labelledby="care-duplicates-heading">
      <ConsolePageHeader
        id="care-duplicates-heading"
        title="Possible duplicates"
        description="People on the care side who may have been entered twice. Families often share an email or phone, so nothing merges until you decide."
        action={clientId ? <Button asChild variant="outline" size="sm"><Link to="/admin/care/duplicates">Show all</Link></Button> : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : matches.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-copy">No possible duplicates</p>
      ) : (
        <div className="flex flex-col gap-4">
          {matches.map((m) => {
            const key = pairKey(m);
            const kept = keptOf(m);
            const dropped = droppedOf(m);
            return (
              <article key={key} className="flex flex-col gap-4 border border-line-soft bg-card p-4">
                <p className="text-[13.5px] font-bold text-ink">{matchReason(m)}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Side p={m.person_a} keeping={kept.id === m.person_a.id} onKeep={() => setKeep({ ...keep, [key]: m.person_a.id })} />
                  <Side p={m.person_b} keeping={kept.id === m.person_b.id} onKeep={() => setKeep({ ...keep, [key]: m.person_b.id })} />
                </div>
                {separateFamilies(m) && (
                  <label className="flex items-start gap-2 text-[13.5px] text-body">
                    <Checkbox
                      checked={!!combine[key]}
                      onCheckedChange={(v) => setCombine({ ...combine, [key]: v === true })}
                    />
                    They are in separate families. Combine the families too, so this family has one history.
                  </label>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-9" disabled={busy === key} onClick={() => different(m)}>
                    Different people
                  </Button>
                  <ConfirmAction
                    title={`Merge ${dropped.full_name} into ${kept.full_name}?`}
                    description={`Everything recorded for ${dropped.full_name} moves to ${kept.full_name}: care records, contact details, family membership, relationships, requests, payments and access. Blank details are filled from ${dropped.full_name}.${combine[key] && separateFamilies(m) ? " Their families become one." : ""} This cannot be undone.`}
                    confirmLabel="Merge"
                    destructive
                    onConfirm={() => merge(m)}
                    disabled={busy === key}
                    trigger={
                      <Button type="button" size="sm" className="h-9" disabled={busy === key}>
                        {busy === key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Same person
                      </Button>
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CareDuplicates;
