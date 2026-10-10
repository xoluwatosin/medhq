// What is outstanding on a person, computed in the database, and who has to
// move each item. The words are "outstanding", never "ready": the person's one
// status is Verified (every required document accepted).
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { MuSection, MuStatus } from "@/components/admin/mu/MuShell";

export interface ReadinessItem {
  code: string;
  sentence: string;
  owner: string;
  sort_order: number;
}

/** Shared loader so the hero, the tab rail and the panel cannot disagree. */
export const useReadiness = (personId: string | undefined, refreshKey?: unknown) => {
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!personId) return;
    const { data } = await (adminDb() as any).rpc("mu_readiness_items", { _person_id: personId });
    setItems(((data as ReadinessItem[]) || []).sort((a, b) => a.sort_order - b.sort_order));
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const office = items.filter((i) => i.owner === "office");
  const candidate = items.filter((i) => i.owner === "candidate");

  const sentence = loading
    ? "Reading the record"
    : items.length === 0
      ? "Nothing is outstanding."
      : office.length === 0
        ? candidate.length === 1
          ? "One item is with the candidate."
          : `${candidate.length} items are with the candidate.`
        : candidate.length === 0
          ? office.length === 1
            ? "One item is with this office."
            : `${office.length} items are with this office.`
          : `${office.length} with this office, ${candidate.length} with the candidate.`;

  return { items, office, candidate, loading, sentence, reload: load };
};

const OWNER_LABEL: Record<string, string> = {
  office: "With this office",
  candidate: "With the candidate",
};

const ReadinessPanel = ({
  items,
  loading,
}: {
  items: ReadinessItem[];
  loading: boolean;
  sentence?: string;
}) => (
  <MuSection title="Outstanding" padded={false}>
    {loading ? (
      <div className="px-5 py-5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
    ) : items.length === 0 ? (
      <div className="px-5 py-4"><MuStatus tone="good" label="Nothing is outstanding" /></div>
    ) : (
      <div className="divide-y divide-line-soft">
        {items.map((item) => (
          <div key={item.code} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5">
            <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug text-navy">{item.sentence}</p>
            <MuStatus
              tone={item.owner === "office" ? "warning" : "neutral"}
              label={OWNER_LABEL[item.owner] ?? item.owner}
            />
          </div>
        ))}
      </div>
    )}
  </MuSection>
);

export default ReadinessPanel;
