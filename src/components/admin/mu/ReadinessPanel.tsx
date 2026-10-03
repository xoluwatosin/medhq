// Placement readiness. One list, computed in the database, of everything that
// stands between this person and a placement, and who has to move it.
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
      ? "Ready for placement. Nothing is outstanding."
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
  sentence,
}: {
  items: ReadinessItem[];
  loading: boolean;
  sentence: string;
}) => (
  <details className="group border border-line bg-card">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
      <span className="text-[14.5px] font-bold tracking-[-0.02em]">Placement readiness</span>
      <span className="min-w-0 flex-1 text-[13.5px] text-muted-foreground">
        {loading ? "Reading the record" : sentence}
      </span>
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span className="group-open:hidden">Open</span>
        <span className="hidden group-open:inline">Close</span>
      </span>
    </summary>
    <div className="border-t border-line-soft">
      <p className="px-5 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
        Everything outstanding before this person can be put forward, and who has to move it. Computed from the
        documents, the record and the questions asked.
      </p>
      {loading ? (
        <div className="px-5 pb-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="border-t border-line-soft px-5 py-6">
          <p className="text-[14.5px] font-semibold tracking-[-0.01em]">Ready for placement</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Every required document is accepted, the record is complete and no question is outstanding.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line-soft border-t border-line-soft">
          {items.map((item) => (
            <div key={item.code} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5">
              <p className="min-w-0 flex-1 text-[14.5px] leading-snug tracking-[-0.01em]">{item.sentence}</p>
              <MuStatus
                tone={item.owner === "office" ? "warning" : "neutral"}
                label={OWNER_LABEL[item.owner] ?? item.owner}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  </details>
);


export default ReadinessPanel;
