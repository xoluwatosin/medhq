// Availability, on a real calendar.
//
// A proper month grid with the month, the day and the year on it, one month at
// a time, plus a separate weekly pattern underneath. The two work together:
// the weekly pattern fills every matching weekday, and any single day you edit
// on the calendar overrides it. Silence stays silence (unknown) and never reads
// as a no.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, ChevronDown, ChevronLeft, ChevronRight, Copy, Repeat, Lock, X } from "lucide-react";
import {
  BLOCKS,
  type AvailabilityState,
  type BlockKey,
  type Blocks,
  type DayRow,
  type RecurrenceRow,
  STATE_LABEL,
  dayState,
  freshnessLabel,
  toBlocks,
  toISODate,
  weekdayOf,
} from "@/lib/availability";
import { CxCard, CxButton } from "@/components/candidate/primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS_AHEAD = 5;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const blockOf = (hour: number): BlockKey =>
  (BLOCKS.find((b) => b.hours.includes(hour))?.key ?? "night");

const hoursOf = (blocks: Blocks): number[] =>
  BLOCKS.flatMap((b) => blocks[b.key] ?? []).sort((a, b) => a - b);

const blocksFromHours = (hours: number[]): Blocks => {
  const out: Blocks = {};
  for (const h of [...hours].sort((a, b) => a - b)) {
    const key = blockOf(h);
    out[key] = [...(out[key] ?? []), h];
  }
  return out;
};

const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let h = from; h !== to; h = (h + 1) % 24) out.push(h);
  return out;
};

const PRESETS: { label: string; hours: number[] }[] = [
  { label: "Day 08:00–20:00", hours: range(8, 20) },
  { label: "Night 20:00–08:00", hours: range(20, 8) },
  { label: "Mornings 07:00–13:00", hours: range(7, 13) },
  { label: "Afternoons 13:00–19:00", hours: range(13, 19) },
  { label: "All 24 hours", hours: Array.from({ length: 24 }, (_, i) => i) },
];

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/** Every date shown in a month grid, padded to whole Monday-start weeks. */
const monthGrid = (year: number, month: number): (Date | null)[] => {
  const first = new Date(year, month, 1);
  const lead = weekdayOf(first);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

interface Props {
  personId: string;
  lastUpdate?: string | null;
  readOnly?: boolean;
  onChanged?: () => void;
}

const AvailabilityCalendar = ({ personId, lastUpdate, readOnly = false, onChanged }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<Map<string, Blocks>>(new Map());
  const [recurrence, setRecurrence] = useState<Map<number, Blocks>>(new Map());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [templateDay, setTemplateDay] = useState<number | null>(null);
  const [templateDraft, setTemplateDraft] = useState<number[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null | undefined>(lastUpdate);
  const [datesOpen, setDatesOpen] = useState(readOnly);
  // Booked shifts and approved leave. Worked out live in the database, never
  // written over what the person told us, and shown on top of the calendar.
  const [committed, setCommitted] = useState<Map<string, { reason: string; label: string | null }>>(new Map());

  const load = useCallback(async () => {
    const horizon = new Date();
    const until = new Date(horizon.getFullYear(), horizon.getMonth() + MONTHS_AHEAD + 1, 0);
    const [{ data: d }, { data: r }, { data: sb }] = await Promise.all([
      supabase.from("mu_availability_days" as any).select("slot_date, blocks").eq("person_id", personId),
      supabase.from("mu_availability_recurrence" as any).select("weekday, blocks, active").eq("person_id", personId),
      supabase.rpc("mu_system_blocks" as any, {
        _person_id: personId,
        _from: toISODate(horizon),
        _to: toISODate(until),
      }),
    ]);
    setCommitted(
      new Map(
        (((sb as any) || []) as { slot_date: string; reason: string; label: string | null }[]).map((x) => [
          x.slot_date,
          { reason: x.reason, label: x.label },
        ]),
      ),
    );
    const dateRows = (d as any as DayRow[]) ?? [];
    setDays(new Map(dateRows.map((x) => [x.slot_date, toBlocks(x.blocks)])));
    setDatesOpen((current) => current || readOnly || dateRows.length > 0);
    setRecurrence(
      new Map(
        ((r as any as RecurrenceRow[]) ?? []).filter((x) => x.active).map((x) => [x.weekday, toBlocks(x.blocks)]),
      ),
    );
    setLoading(false);
  }, [personId, readOnly]);

  useEffect(() => { load(); }, [load]);

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
  const firstMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const lastMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD, 1),
    [today],
  );

  const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const summary = useMemo(() => {
    let available = 0, unavailable = 0, unknown = 0;
    for (const d of cells) {
      if (!d || d < today) continue;
      const s = dayState(d, days, recurrence);
      if (s === "available") available += 1;
      else if (s === "unavailable") unavailable += 1;
      else unknown += 1;
    }
    return { available, unavailable, unknown };
  }, [cells, days, recurrence, today]);

  // Plain English, and never a row of zeros. We only mention what is actually there.
  const summarySentence = useMemo(() => {
    const monthName = cursor.toLocaleDateString("en-GB", { month: "long" });
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const parts: string[] = [];
    if (summary.available > 0) parts.push(`${plural(summary.available, "day", "days")} marked free`);
    if (committed.size > 0) parts.push(`${plural(committed.size, "day", "days")} booked or on leave`);
    else if (summary.unavailable > 0) parts.push(`${plural(summary.unavailable, "day", "days")} unavailable`);
    if (parts.length === 0) {
      return `You have not told us about any day in ${monthName} yet. Tap a date to say when you can work.`;
    }
    const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    const rest =
      summary.unknown > 0
        ? ` The other ${plural(summary.unknown, "day is", "days are")} still open, so we will keep asking.`
        : "";
    return `In ${monthName} you have ${list}.${rest}`;
  }, [committed.size, cursor, summary]);


  const touch = () => {
    setUpdatedAt(new Date().toISOString());
    onChanged?.();
  };

  const blocksFor = (d: Date): Blocks | null => {
    const explicit = days.get(toISODate(d));
    if (explicit !== undefined) return explicit;
    return recurrence.get(weekdayOf(d)) ?? null;
  };

  const openEditor = (d: Date) => {
    if (readOnly || d < today) return;
    setDraft(hoursOf(blocksFor(d) ?? {}));
    setOpenDay(d);
  };

  const toggleHour = (list: number[], h: number) =>
    list.includes(h) ? list.filter((x) => x !== h) : [...list, h].sort((a, b) => a - b);

  const saveDay = async () => {
    if (!openDay) return;
    setSaving(true);
    const iso = toISODate(openDay);
    const blocks = blocksFromHours(draft);
    const { error } = await supabase
      .from("mu_availability_days" as any)
      .upsert({ person_id: personId, slot_date: iso, blocks }, { onConflict: "person_id,slot_date" });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
      return;
    }
    setDays((prev) => new Map(prev).set(iso, blocks));
    touch();
    setOpenDay(null);
  };

  // Clearing is not the same as "booked": the day goes back to unknown and the
  // weekly pattern (or silence) takes over again.
  const clearDay = async () => {
    if (!openDay) return;
    setSaving(true);
    const iso = toISODate(openDay);
    const { error } = await supabase
      .from("mu_availability_days" as any)
      .delete()
      .eq("person_id", personId)
      .eq("slot_date", iso);
    setSaving(false);
    if (error) {
      toast({ title: "Could not clear", description: "Please try again.", variant: "destructive" });
      return;
    }
    setDays((prev) => { const next = new Map(prev); next.delete(iso); return next; });
    touch();
    setOpenDay(null);
  };

  const saveTemplateDay = async (weekday: number, hours: number[] | null) => {
    setSaving(true);
    if (hours === null) {
      const { error } = await supabase
        .from("mu_availability_recurrence" as any)
        .delete()
        .eq("person_id", personId)
        .eq("weekday", weekday);
      setSaving(false);
      if (error) {
        toast({ title: "Could not clear", description: "Please try again.", variant: "destructive" });
        return;
      }
      setRecurrence((prev) => { const next = new Map(prev); next.delete(weekday); return next; });
    } else {
      const blocks = blocksFromHours(hours);
      const { error } = await supabase
        .from("mu_availability_recurrence" as any)
        .upsert({ person_id: personId, weekday, blocks, active: true }, { onConflict: "person_id,weekday" });
      setSaving(false);
      if (error) {
        toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
        return;
      }
      setRecurrence((prev) => new Map(prev).set(weekday, blocks));
    }
    touch();
  };

  if (loading) {
    return (
      <CxCard className="flex items-center gap-2 p-5 text-body">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your calendar…
      </CxCard>
    );
  }

  const hourGrid = (selected: number[], set: (next: number[]) => void) => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => set(p.hours)}
            className="cx-chip border border-line bg-white px-3 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-navy hover:text-navy"
          >
            {p.label}
          </button>
        ))}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => set([])}
            className="cx-chip px-3 py-2 text-[13px] font-semibold text-body transition-colors hover:text-ink"
          >
            Clear hours
          </button>
        )}
      </div>
      {BLOCKS.map((b) => {
        const allOn = b.hours.every((h) => selected.includes(h));
        return (
          <div key={b.key} className="cx-card border border-line bg-desk/40 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-bold text-ink">
                {b.label} · {String(b.hours[0]).padStart(2, "0")}:00–{String((b.hours[b.hours.length - 1] + 1) % 24).padStart(2, "0")}:00
              </p>
              <button
                type="button"
                onClick={() => set(allOn
                  ? selected.filter((h) => !b.hours.includes(h))
                  : [...new Set([...selected, ...b.hours])].sort((x, y) => x - y))}
                className="text-[13px] font-bold text-brand hover:text-navy"
              >
                {allOn ? "Unselect" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {b.hours.map((h) => {
                const on = selected.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set(toggleHour(selected, h))}
                    className={cn(
                      "cx-chip py-2.5 text-[14px] font-semibold tabular-nums transition-colors",
                      on ? "bg-navy text-white" : "border border-line bg-white text-body hover:border-navy",
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Recurring choices, kept separate but feeding the same calendar. */}
      {!readOnly && (
        <CxCard className="p-4 sm:p-[22px]">
          {templateDay === null ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="cx-control flex h-9 w-9 shrink-0 items-center justify-center bg-tint text-navy">
                  <Repeat className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-ink">Your usual week</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-body">
                    Set it once and every matching date fills in. You can adjust any date below if it is different.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {DAY_FULL.map((name, weekday) => {
                  const blocks = recurrence.get(weekday);
                  const hours = hoursOf(blocks ?? {});
                  return (
                    <div key={name} className="cx-card border border-line bg-desk/30 p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-bold text-ink">{name}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setTemplateDraft(hours); setTemplateDay(weekday); }}
                            className="cx-control min-h-11 px-2.5 py-1.5 text-[13px] font-bold text-brand hover:text-navy"
                          >
                            Edit
                          </button>
                          {blocks && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => saveTemplateDay(weekday, null)}
                              className="cx-control min-h-11 px-2.5 py-1.5 text-[13px] font-bold text-body hover:text-ink"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-body">
                        {blocks
                          ? hours.length
                            ? `Free for ${hours.length} ${hours.length === 1 ? "hour" : "hours"}, ${BLOCKS.filter((b) => (blocks[b.key]?.length ?? 0) > 0).map((b) => b.label.toLowerCase()).join(" and ")}`
                            : "You are not working this day"
                          : "You have not told us about this day yet"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <p className="cx-heading text-[18px] text-ink">Every {DAY_FULL[templateDay]}</p>
                <button
                  type="button"
                  onClick={() => setTemplateDay(null)}
                  className="text-[13px] font-bold text-body hover:text-ink"
                >
                  Back
                </button>
              </div>
              {hourGrid(templateDraft, setTemplateDraft)}
              <div className="flex flex-col gap-3 sm:flex-row">
                <CxButton
                  className="sm:flex-1"
                  disabled={saving}
                  onClick={async () => { await saveTemplateDay(templateDay, templateDraft); setTemplateDay(null); }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save this day"}
                </CxButton>
                <CxButton
                  rank="secondary"
                  disabled={saving}
                  onClick={async () => {
                    for (let wd = 0; wd < 5; wd += 1) await saveTemplateDay(wd, templateDraft);
                    setTemplateDay(null);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />Apply Mon–Fri
                </CxButton>
              </div>
            </div>
          )}
        </CxCard>
      )}

      {!readOnly && Array.from(recurrence.values()).some((blocks) => hoursOf(blocks).length > 0) && (
        <p className="px-1 text-[14px] font-medium leading-relaxed text-body">
          That is all we need. We will only bring you work that fits.
        </p>
      )}

      <Collapsible open={datesOpen} onOpenChange={setDatesOpen}>
        <div className="border-y border-line py-1">
          <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-4 py-3 text-left">
            <span>
              <span className="block text-[16px] font-semibold text-ink">Adjust specific dates</span>
              <span className="mt-0.5 block text-[14px] leading-relaxed text-body">
                Only if some dates are different from your usual week.
              </span>
            </span>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-body transition-transform", datesOpen && "rotate-180")} />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-5">
      <CxCard kind="emphasis" className="p-4 sm:p-[22px]">
        {/* Month, day and year, on the face of it. */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={monthKey(cursor) === monthKey(firstMonth)}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Previous month"
            className="cx-control flex h-11 w-11 items-center justify-center border border-line bg-white text-ink transition-colors hover:border-navy disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="cx-heading text-[18px] text-ink sm:text-[21px]">
            {cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            disabled={monthKey(cursor) === monthKey(lastMonth)}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Next month"
            className="cx-control flex h-11 w-11 items-center justify-center border border-line bg-white text-ink transition-colors hover:border-navy disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-[14px] leading-relaxed text-body">{summarySentence}</p>
          <span className="ml-auto text-[13px] text-body">{freshnessLabel(updatedAt)}</span>
        </div>


        <div className="mt-4 overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="grid grid-cols-7 border-b border-line bg-desk/60 text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-body sm:text-[11px] sm:tracking-[0.08em]">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-1.5 sm:py-2">{d.slice(0, 3)}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d) return <div key={`pad-${i}`} className="h-[52px] border-b border-r border-line/60 bg-desk/25 last:border-r-0 sm:h-[70px]" />;
              const s: AvailabilityState = dayState(d, days, recurrence);
              const blocks = blocksFor(d) ?? {};
              const past = d < today;
              const isToday = toISODate(d) === toISODate(new Date());
              const fromTemplate = !days.has(toISODate(d)) && recurrence.has(weekdayOf(d));
              const held = committed.get(toISODate(d));
              const marked = BLOCKS.filter((b) => (blocks[b.key]?.length ?? 0) > 0);
              return (
                <button
                  key={toISODate(d)}
                  type="button"
                  onClick={() => openEditor(d)}
                  disabled={readOnly || past}
                  title={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} - ${
                    held ? (held.reason === "leave" ? "On leave" : `Booked: ${held.label ?? "shift"}`) : STATE_LABEL[s]
                  }`}
                  className={cn(
                    "relative flex h-[52px] flex-col items-center justify-center gap-1 border-b border-r border-line/60 transition-colors sm:h-[70px] sm:gap-1.5",
                    (i + 1) % 7 === 0 && "border-r-0",
                    !past && s === "available" && "bg-tint",
                    !past && held && "bg-tint",
                    past && "bg-desk/25 text-body/40",
                    !readOnly && !past && "hover:bg-desk/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[13.5px] tabular-nums leading-none sm:h-7 sm:w-7 sm:text-[14px]",
                      isToday ? "bg-navy font-bold text-white" : s === "unknown" ? "font-medium text-body" : "font-bold text-ink",
                      past && "text-body/40",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {held && !past ? (
                    <span className="flex items-center gap-0.5 text-[9.5px] font-semibold leading-none text-navy sm:text-[10px]">
                      <Lock className="h-2.5 w-2.5" />
                      {held.reason === "leave" ? "leave" : "booked"}
                    </span>
                  ) : marked.length > 0 && !past ? (
                    <span className="flex gap-[3px]">
                      {marked.map((b) => (
                        <span key={b.key} className="h-1.5 w-1.5 rounded-full bg-navy" />
                      ))}
                    </span>
                  ) : (
                    <span className="h-1.5">{fromTemplate && !past && <span className="text-[9px] leading-none text-body">weekly</span>}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-3.5 text-[13.5px] leading-relaxed text-body sm:text-[14px]">
          Tap a date to set your hours. The dots show the parts of the day you are free. A day you leave
          alone stays open and never counts against you.
        </p>
        <p className="mt-2 hidden text-[14px] leading-relaxed text-body sm:block">
          Days marked as booked or on leave are work you have already accepted, or time off we have agreed.
        </p>
      </CxCard>

        </CollapsibleContent>
      </Collapsible>

      {/* Day editor modal */}
      {openDay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-[560px] rounded-t-[18px] bg-desk p-5 shadow-2xl sm:rounded-[18px] sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <p className="cx-heading text-[19px] text-ink">
                {openDay.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                onClick={() => setOpenDay(null)}
                className="cx-control flex h-9 w-9 items-center justify-center text-body hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
              {hourGrid(draft, setDraft)}
              <p className="text-[14px] leading-relaxed text-body">
                Saving with no hours selected tells us you are booked that day. Clearing the day removes your answer
                entirely and hands the day back to your usual week.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <CxButton onClick={saveDay} disabled={saving} className="sm:flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : draft.length ? `Save ${draft.length} hour${draft.length === 1 ? "" : "s"}` : "Mark booked"}
                </CxButton>
                <CxButton rank="secondary" onClick={clearDay} disabled={saving}>
                  Clear day
                </CxButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
