// Exactly what a candidate has told us about their time, read only.
//
// Three states, never blurred: available, unavailable, and unknown, where
// unknown means silence rather than a no. Hours are shown as they were given,
// so admin can see the precise shift rather than a colour.
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminDb } from "@/lib/admin-utils";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { MuStatus } from "./MuShell";
import {
  BLOCKS,
  BLOCK_LABEL,
  type BlockKey,
  type Blocks,
  addDays,
  dayState,
  freshnessLabel,
  resolveDay,
  startOfWeek,
  toBlocks,
  toISODate,
} from "@/lib/availability";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pad = (n: number) => String(n).padStart(2, "0");

/** 7,8,9,13,14 -> "07:00–10:00, 13:00–15:00". Contiguous hours are joined up. */
const hoursSentence = (blocks: Blocks): string => {
  const hours = BLOCKS.flatMap((b) => blocks[b.key] ?? []).sort((a, b) => a - b);
  if (!hours.length) return "";
  const runs: [number, number][] = [];
  for (const h of hours) {
    const last = runs[runs.length - 1];
    if (last && h === last[1]) last[1] = h + 1;
    else runs.push([h, h + 1]);
  }
  // A run that ends at midnight reads better as 24:00 than 00:00.
  return runs.map(([a, b]) => `${pad(a)}:00–${pad(b % 24 === 0 ? 24 : b % 24)}:00`).join(", ");
};

const blockChips = (blocks: Blocks): { key: BlockKey; label: string; hours: string }[] =>
  BLOCKS.filter((b) => (blocks[b.key]?.length ?? 0) > 0).map((b) => ({
    key: b.key,
    label: BLOCK_LABEL[b.key],
    hours: hoursSentence({ [b.key]: blocks[b.key] } as Blocks),
  }));

const humanDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

interface Props {
  personId: string;
  lastUpdate?: string | null;
  /** How many weeks forward to show. */
  weeks?: number;
  /** Start from this date instead of today, so a search window can be mirrored. */
  from?: string;
  className?: string;
}

const AvailabilityDetail = ({ personId, lastUpdate, weeks = 8, from, className }: Props) => {
  const [days, setDays] = useState<Map<string, Blocks>>(new Map());
  const [recurrence, setRecurrence] = useState<Map<number, Blocks>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: r }] = await Promise.all([
      adminDb().from("mu_availability_days" as any).select("slot_date, blocks").eq("person_id", personId),
      adminDb().from("mu_availability_recurrence" as any).select("weekday, blocks, active").eq("person_id", personId),
    ]);
    const dm = new Map<string, Blocks>();
    for (const row of ((d as any) || []) as { slot_date: string; blocks: unknown }[]) {
      dm.set(row.slot_date, toBlocks(row.blocks));
    }
    const rm = new Map<number, Blocks>();
    for (const row of ((r as any) || []) as { weekday: number; blocks: unknown; active: boolean }[]) {
      if (row.active) rm.set(row.weekday, toBlocks(row.blocks));
    }
    setDays(dm);
    setRecurrence(rm);
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const start = useMemo(() => startOfWeek(from ? new Date(`${from}T00:00:00`) : new Date()), [from]);

  const grid = useMemo(() => {
    const rows: Date[][] = [];
    for (let w = 0; w < weeks; w += 1) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
    }
    return rows;
  }, [start, weeks]);

  const named = useMemo(() => {
    const out: { date: Date; blocks: Blocks; source: "day" | "recurrence" }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const week of grid) {
      for (const date of week) {
        if (date < today) continue;
        const { blocks, source } = resolveDay(date, days, recurrence);
        if (!blocks || !source) continue;
        if (BLOCKS.every((b) => (blocks[b.key]?.length ?? 0) === 0)) continue;
        out.push({ date, blocks, source });
      }
    }
    return out;
  }, [grid, days, recurrence]);

  const counts = useMemo(() => {
    let free = 0, booked = 0, silent = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const week of grid) {
      for (const date of week) {
        if (date < today) continue;
        const s = dayState(date, days, recurrence);
        if (s === "available") free += 1;
        else if (s === "unavailable") booked += 1;
        else silent += 1;
      }
    }
    return { free, booked, silent };
  }, [grid, days, recurrence]);

  const weekly = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ weekday: i, blocks: recurrence.get(i) ?? null })),
    [recurrence],
  );

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-6 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" /> Reading their calendar…
      </div>
    );
  }

  const todayIso = toISODate(new Date());

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <MuStatus tone={counts.free > 0 ? "good" : "neutral"} label={`${counts.free} of ${weeks * 7} days free`} />
        {counts.booked > 0 && <MuStatus tone="warning" label={`${counts.booked} booked`} />}
        {counts.silent > 0 && <MuStatus label={`${counts.silent} not told us`} />}
        <MuStatus label={freshnessLabel(lastUpdate)} />
      </div>

      {/* The usual week they told us about, before any single day overrides it. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Their usual week</p>
        {weekly.every((w) => !w.blocks) ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No usual week set</p>
        ) : (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {weekly.map((w) => {
              const chips = w.blocks ? blockChips(w.blocks) : [];
              return (
                <div
                  key={w.weekday}
                  className={cn(
                    "border px-2.5 py-1.5 text-xs",
                    chips.length ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30",
                  )}
                >
                  <span className="font-medium text-foreground">{DAY_FULL[w.weekday]}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {!w.blocks
                      ? "Not told us"
                      : chips.length
                        ? hoursSentence(w.blocks)
                        : "Booked all day"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Every day, at a glance, with the exact hours on hover. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
          Next {weeks} weeks, day by day
        </p>
        <div className="mt-2 overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="space-y-1">
              {grid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((date) => {
                    const s = dayState(date, days, recurrence);
                    const { blocks, source } = resolveDay(date, days, recurrence);
                    const iso = toISODate(date);
                    const chips = blocks ? blockChips(blocks) : [];
                    const title =
                      s === "available"
                        ? `${humanDate(date)}: free ${hoursSentence(blocks || {})}${source === "recurrence" ? " (from their usual week)" : ""}`
                        : s === "unavailable"
                          ? `${humanDate(date)}: booked all day`
                          : `${humanDate(date)}: they have not told us`;
                    return (
                      <div
                        key={iso}
                        title={title}
                        className={cn(
                          "border px-1 py-1 text-center",
                          s === "available" && "border-primary/50 bg-primary/10",
                          s === "unavailable" && "border-destructive/40 bg-destructive/10",
                          s === "unknown" && "border-dashed border-border/70 bg-muted/20",
                          iso === todayIso && "ring-1 ring-primary",
                        )}
                      >
                        <div className="text-[11px] font-medium tabular-nums text-foreground">{date.getDate()}</div>
                        <div className="mt-0.5 flex justify-center gap-0.5">
                          {BLOCKS.map((b) => (
                            <span
                              key={b.key}
                              className={cn(
                                "h-1 w-1",
                                chips.some((c) => c.key === b.key) ? "bg-primary" : "bg-border",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-primary/50 bg-primary/10" /> Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-destructive/40 bg-destructive/10" /> Booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-dashed border-border/70 bg-muted/20" /> Not told us
          </span>
          <span>Dots: morning, afternoon, evening, night</span>
        </div>
      </div>

      {/* The plain list, because a grid is no use when you are typing a shift into a message. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
          The exact hours they gave
        </p>
        {named.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No free hours named in this window</p>
        ) : (
          <ul className="mt-2 divide-y divide-line-soft border border-line">
            {named.slice(0, 60).map(({ date, blocks, source }) => (
              <li key={toISODate(date)} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span className="text-sm font-medium text-foreground">{humanDate(date)}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {blockChips(blocks).map((c) => (
                    <span key={c.key} className="border border-border/70 bg-muted/40 px-2 py-0.5">
                      {c.label} {c.hours}
                    </span>
                  ))}
                  {source === "recurrence" && <span className="italic">from their usual week</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {named.length > 60 && (
          <p className="mt-1.5 text-xs text-muted-foreground">Showing the first 60 days</p>
        )}
      </div>
    </div>
  );
};

export default AvailabilityDetail;
