// The structured clinical controls for the Care questionnaires.
//
// Conditions, medicines and allergies are picked from the universal lists in
// src/lib/care-clinical-lists.ts, so two families describing the same thing
// record the same code. Anything not on a list is kept as the person's own
// words, in its own place, and is never quietly turned into a code.
//
// Each control holds a list of entries. An entry is added deliberately and
// removed deliberately; nothing is added by typing alone.
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cxInputClass } from "@/components/candidate/primitives";
import { DateField } from "@/components/field";
import { supabase } from "@/integrations/supabase/client";
import {
  ALLERGY_REACTIONS, ALLERGY_SEVERITIES, CLINICAL_LISTS, clinicalLabel,
  groupLabel, groupedTerms, searchTerms, type ClinicalListName,
} from "@/lib/care-clinical-lists";
import { APPOINTMENT_PERIODS, type CareField } from "@/lib/care";

const entries = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((v) => !!v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown>[]
    : [];

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const chipOn = "border-[1.5px] border-navy bg-tint font-bold text-navy";
const chipOff = "border border-line bg-white text-ink hover:bg-desk/60";
const chip = "cx-control min-h-10 px-3 py-2 text-left text-[15px] leading-snug transition-colors";

const removeButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-none border border-line text-ink2 hover:bg-desk";

/* ---- how a dose is held --------------------------------------------- */
//
// A dose is what the family already takes, recorded as an amount and a unit.
// Nothing is suggested, defaulted or calculated: the amount is typed by the
// person and the unit is chosen from plain words, never a clinical schedule.

export const DOSE_UNITS = [
  "tablet", "tablets", "capsule", "capsules", "ml", "mg", "g",
  "drop", "drops", "puff", "puffs", "sachet", "sachets", "patch",
  "spoonful", "unit", "units",
];

export const DOSE_FREQUENCIES = [
  "Once a day", "Twice a day", "Three times a day", "Four times a day",
  "Every other day", "Once a week", "In the morning", "At night",
  "Only when needed",
];

/** Reads "2 tablets" back into its parts, leaving anything older as the amount. */
export const readDose = (value: unknown): { amount: string; unit: string } => {
  const held = String(value ?? "").trim();
  if (!held) return { amount: "", unit: "" };
  const match = /^(\S+)\s+(.+)$/.exec(held);
  if (match && DOSE_UNITS.includes(match[2])) return { amount: match[1], unit: match[2] };
  return { amount: held, unit: "" };
};

export const writeDose = (amount: string, unit: string): string | null => {
  const parts = [amount.trim(), unit.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
};



/* ------------------------------------------------------------------ */
/* Conditions, medicines and allergies                                 */
/* ------------------------------------------------------------------ */

interface ClinicalListProps {
  list: ClinicalListName;
  value: unknown;
  onChange: (value: unknown) => void;
}

const noun: Record<ClinicalListName, { one: string; add: string; search: string }> = {
  condition: { one: "condition", add: "Add a condition", search: "Search conditions" },
  medicine: { one: "medicine", add: "Add a medicine", search: "Search medicines" },
  allergen: { one: "allergy", add: "Add an allergy", search: "Search allergies" },
};

export const ClinicalListAnswer = ({ list, value, onChange }: ClinicalListProps) => {
  const chosen = entries(value);
  const { terms, groups } = CLINICAL_LISTS[list];
  const [adding, setAdding] = useState(chosen.length === 0);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => searchTerms(terms, query, query.trim() ? 12 : 0), [terms, query]);
  const browse = useMemo(() => groupedTerms(terms, groups), [terms, groups]);

  const update = (index: number, patch: Record<string, unknown>) => {
    const next = chosen.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };
  const add = (entry: Record<string, unknown>) => {
    onChange([...chosen, entry]);
    setQuery("");
    setAdding(false);
  };
  const remove = (index: number) => {
    const next = chosen.filter((_, i) => i !== index);
    onChange(next.length ? next : null);
  };

  const already = new Set(chosen.map((e) => String(e.code ?? "")));

  return (
    <div className="flex flex-col gap-3">
      {chosen.map((entry, index) => {
        const named = entry.code
          ? clinicalLabel(terms, String(entry.code))
          : String(entry.other ?? "");
        return (
          <div key={`${String(entry.code ?? entry.other ?? "")}-${index}`} className="border border-line bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15.5px] font-bold leading-snug text-ink">{named}</p>
              <button type="button" className={removeButton} aria-label={`Remove ${named}`} onClick={() => remove(index)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {list === "medicine" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink2">How much</span>
                  <input
                    className={cxInputClass()}
                    inputMode="decimal"
                    placeholder="1"
                    value={readDose(entry.dose).amount}
                    onChange={(e) =>
                      update(index, { dose: writeDose(e.target.value, readDose(entry.dose).unit) })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink2">Unit</span>
                  <select
                    className={cxInputClass()}
                    value={readDose(entry.dose).unit}
                    onChange={(e) =>
                      update(index, { dose: writeDose(readDose(entry.dose).amount, e.target.value) })
                    }
                  >
                    <option value="">Choose</option>
                    {DOSE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink2">How often</span>
                  <select
                    className={cxInputClass()}
                    value={DOSE_FREQUENCIES.includes(String(entry.frequency ?? "")) ? String(entry.frequency) : ""}
                    onChange={(e) => update(index, { frequency: e.target.value || null })}
                  >
                    <option value="">Choose</option>
                    {DOSE_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}


            {list === "allergen" && (
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <p className="text-[15px] font-bold text-ink2">How bad was the reaction?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALLERGY_SEVERITIES.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        className={cn(chip, entry.severity === s.code ? chipOn : chipOff)}
                        onClick={() => update(index, { severity: entry.severity === s.code ? null : s.code })}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-ink2">What happened?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALLERGY_REACTIONS.map((r) => {
                      const picked = Array.isArray(entry.reaction) ? entry.reaction as string[] : [];
                      const on = picked.includes(r.code);
                      return (
                        <button
                          key={r.code}
                          type="button"
                          className={cn(chip, on ? chipOn : chipOff)}
                          onClick={() =>
                            update(index, {
                              reaction: on ? picked.filter((p) => p !== r.code) : [...picked, r.code],
                            })
                          }
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {list === "condition" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink2">Since when</span>
                  <input
                    className={cxInputClass()}
                    placeholder="2019, or two years ago"
                    value={String(entry.since ?? "")}
                    onChange={(e) => update(index, { since: e.target.value })}
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-bold text-ink2">Is it ongoing?</span>
                  <div className="flex gap-2">
                    {[{ v: true, l: "Yes" }, { v: false, l: "In the past" }].map((o) => (
                      <button
                        key={o.l}
                        type="button"
                        className={cn(chip, entry.ongoing === o.v ? chipOn : chipOff)}
                        onClick={() => update(index, { ongoing: o.v })}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-[15px] font-bold text-ink2">Anything else about this {noun[list].one}</span>
              <input
                className={cxInputClass()}
                value={String(entry.notes ?? "")}
                onChange={(e) => update(index, { notes: e.target.value })}
              />
            </label>
          </div>
        );
      })}

      {!adding ? (
        <button
          type="button"
          className={cn(chip, chipOff, "inline-flex w-auto items-center gap-2 self-start")}
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" /> {noun[list].add}
        </button>
      ) : (
        <div className="border border-line bg-white p-3">
          <input
            className={cxInputClass()}
            placeholder={noun[list].search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={noun[list].search}
          />

          {query.trim() ? (
            <div className="mt-3 flex flex-col gap-2">
              {matches
                .filter((t) => !already.has(t.code))
                .map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    className={cn(chip, chipOff)}
                    onClick={() => add({ code: t.code })}
                  >
                    {t.label}
                    <span className="ml-2 text-[12.5px] font-normal text-body">
                      {groupLabel(groups, t.group)}
                    </span>
                  </button>
                ))}
              <button
                type="button"
                className={cn(chip, chipOff)}
                onClick={() => add({ other: query.trim() })}
              >
                Add "{query.trim()}" in my own words
              </button>
            </div>
          ) : (
            <div className="mt-3 max-h-[320px] overflow-y-auto pr-1">
              {browse.map(({ group, terms: groupTerms }) => (
                <div key={group.code} className="mt-3 first:mt-0">
                  <p className="text-[15px] font-bold text-ink2">{group.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupTerms
                      .filter((t) => !already.has(t.code))
                      .map((t) => (
                        <button
                          key={t.code}
                          type="button"
                          className={cn(chip, chipOff)}
                          onClick={() => add({ code: t.code })}
                        >
                          {t.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {chosen.length > 0 && (
            <button
              type="button"
              className="mt-3 text-[15px] font-bold text-navy underline"
              onClick={() => { setAdding(false); setQuery(""); }}
            >
              Done adding
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Hospital and professional                                           */
/* ------------------------------------------------------------------ */

const boxes = (
  parts: { key: string; label: string; placeholder?: string }[],
  value: unknown,
  onChange: (v: unknown) => void,
) => {
  const current = asObject(value);
  const set = (key: string, next: string) => {
    const merged = { ...current, [key]: next };
    const empty = Object.values(merged).every((v) => !String(v ?? "").trim());
    onChange(empty ? null : merged);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {parts.map((part) => (
        <label key={part.key} className="flex flex-col gap-1.5">
          <span className="text-[15px] font-bold text-ink2">{part.label}</span>
          <input
            className={cxInputClass()}
            placeholder={part.placeholder}
            value={String(current[part.key] ?? "")}
            onChange={(e) => set(part.key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
};

export const HospitalAnswer = ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) =>
  boxes(
    [
      { key: "name", label: "Hospital or clinic", placeholder: "Lagos University Teaching Hospital" },
      { key: "area", label: "Where it is", placeholder: "Idi-Araba, Lagos" },
      { key: "department", label: "Ward or department" },
      { key: "phone", label: "Their phone number" },
    ],
    value,
    onChange,
  );

export const ProfessionalAnswer = ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) =>
  boxes(
    [
      { key: "name", label: "Their name" },
      { key: "role", label: "What they do", placeholder: "Consultant physician" },
      { key: "place", label: "Where they see you" },
      { key: "phone", label: "Their phone number" },
    ],
    value,
    onChange,
  );

/* ------------------------------------------------------------------ */
/* Appointment preferences                                             */
/* ------------------------------------------------------------------ */

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export interface AppointmentTimeSlot {
  period: string;
  start: string;
  end: string;
  label: string;
}

export const APPOINTMENT_TIMES: Record<string, string[]> = {
  morning: ["08:00", "09:00", "10:00", "11:00"],
  afternoon: ["12:00", "13:00", "14:00", "15:00"],
  evening: ["16:00", "17:00", "18:00", "19:00"],
};

export const suggestedAppointmentDates = (
  weekdays: unknown,
  now = new Date(),
  limit = 8,
): string[] => {
  const selected = Array.isArray(weekdays)
    ? new Set(weekdays.map(String).map((day) => DAY_INDEX[day]).filter((day) => day !== undefined))
    : new Set<number>();
  if (selected.size === 0) return [];
  const dates: string[] = [];
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  for (let offset = 1; offset <= 42 && dates.length < limit; offset += 1) {
    date.setTime(now.getTime());
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    if (selected.has(date.getDay())) dates.push(isoDay(date));
  }
  return dates;
};

const nextHour = (start: string) => `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00`;

export const appointmentTimesForPeriods = (periods: unknown): AppointmentTimeSlot[] =>
  (Array.isArray(periods) ? periods : [])
    .map(String)
    .flatMap((period) => (APPOINTMENT_TIMES[period] ?? []).map((start) => {
      const end = nextHour(start);
      return { period, start, end, label: `${displayTime(start)}–${displayTime(end)}` };
    }));

const displayDate = (value: string) => new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short",
}).format(new Date(`${value}T12:00:00`));

const displayTime = (value: string) => new Intl.DateTimeFormat("en-GB", {
  hour: "numeric", minute: "2-digit", hour12: true,
}).format(new Date(`2026-01-01T${value}:00`));

/** Tomorrow onwards: a preference is never asked for a day already gone. */
export const earliestPreferredDate = (now = new Date()): string => {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  return isoDay(next);
};

export const AppointmentPreferenceAnswer = ({
  value,
  responses,
  onChange,
}: { value: unknown; responses?: Record<string, unknown>; onChange: (v: unknown) => void }) => {
  const current = asObject(value);
  const slots = Array.isArray(current.slots) ? current.slots as Record<string, unknown>[] : [];
  const min = earliestPreferredDate();
  const weekdays = responses?.care_days;
  const periods = responses?.care_times;
  const [showCalendar, setShowCalendar] = useState(false);
  const allSuggestedDates = useMemo(() => suggestedAppointmentDates(weekdays, new Date(), 16), [weekdays]);
  const suggestedDates = showCalendar ? allSuggestedDates : allSuggestedDates.slice(0, 8);
  const exactTimes = useMemo(() => appointmentTimesForPeriods(periods), [periods]);
  const precise = suggestedDates.length > 0 && exactTimes.length > 0;
  const [visibleCount, setVisibleCount] = useState(Math.max(1, Math.min(3, slots.length || 1)));

  const write = (nextSlots: Record<string, unknown>[], notes = current.notes) => {
    const kept = nextSlots.filter((s) => String(s.date ?? "").trim());
    const empty = kept.length === 0 && !String(notes ?? "").trim();
    onChange(empty ? null : { slots: kept, notes: notes ?? "" });
  };

  useEffect(() => {
    if (!precise || slots.length === 0) return;
    const dates = new Set(allSuggestedDates);
    const starts = new Set(exactTimes.map((item) => item.start));
    const next = slots.map((slot) => {
      const heldStart = String(slot.start ?? slot.time ?? "");
      const option = starts.has(heldStart) ? exactTimes.find((item) => item.start === heldStart) : undefined;
      return {
        ...slot,
        date: dates.has(String(slot.date ?? "")) ? slot.date : null,
        period: option?.period ?? null,
        start: option?.start ?? null,
        end: option?.end ?? null,
        time: null,
      };
    });
    if (JSON.stringify(next) !== JSON.stringify(slots)) write(next);
  }, [allSuggestedDates, exactTimes, precise, slots]);

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: visibleCount }).map((_, index) => {
        const slot = slots[index] ?? {};
        return (
          <div key={index} className="border-t border-hairline-warm py-3 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-ink2">
                {index === 0 ? "Preferred date" : `Alternative ${index}`}
              </p>
              {index > 0 && (
                <button
                  type="button"
                  className={removeButton}
                  aria-label={`Remove alternative ${index}`}
                  onClick={() => {
                    write(slots.filter((_, slotIndex) => slotIndex !== index));
                    setVisibleCount((count) => Math.max(1, count - 1));
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {precise ? (
              <>
                <p className="mt-2 text-[13px] text-body">Choose a date based on the days selected above.</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {suggestedDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className={cn(chip, String(slot.date ?? "") === date ? chipOn : chipOff)}
                      onClick={() => {
                        const copy = [...slots];
                        copy[index] = { ...slot, date };
                        write(copy);
                      }}
                    >
                      {displayDate(date)}
                    </button>
                  ))}
                </div>
                <button type="button" className="mt-2 text-left text-[13px] font-bold text-brand underline" onClick={() => setShowCalendar((shown) => !shown)}>
                  {showCalendar ? "Hide other dates" : "Choose a later date"}
                </button>
                {slot.date && (
                  <div className="mt-3">
                    <p className="text-[13px] font-bold text-ink2">Choose a time</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exactTimes.map((option) => (
                        <button
                          key={`${option.period}-${option.start}`}
                          type="button"
                          className={cn(chip, String(slot.start ?? slot.time ?? "") === option.start ? chipOn : chipOff)}
                          onClick={() => {
                            const copy = [...slots];
                            copy[index] = {
                              ...slot,
                              period: option.period,
                              start: option.start,
                              end: option.end,
                              time: null,
                            };
                            write(copy);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="sm:w-[220px]">
                  <DateField
                    hideLabel
                    label="Preferred date"
                    value={String(slot.date ?? "")}
                    min={min}
                    onChange={(next) => {
                      const copy = [...slots];
                      copy[index] = { ...slot, date: next };
                      write(copy);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {APPOINTMENT_PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={cn(chip, slot.period === p.value ? chipOn : chipOff)}
                    onClick={() => {
                      const copy = [...slots];
                      copy[index] = { ...slot, period: slot.period === p.value ? null : p.value };
                      write(copy);
                    }}
                  >
                    {p.label}
                  </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {visibleCount < 3 && (
        <button
          type="button"
          className={cn(chip, chipOff, "inline-flex w-auto items-center gap-2 self-start")}
          onClick={() => setVisibleCount((count) => Math.min(3, count + 1))}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add another option
        </button>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-ink2">Anything we should know about timing</span>
        <input
          className={cxInputClass()}
          placeholder="Please avoid Friday afternoons"
          value={String(current.notes ?? "")}
          onChange={(e) => write(slots, e.target.value)}
        />
      </label>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Uploads                                                             */
/* ------------------------------------------------------------------ */

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic";

interface UploadProps {
  field: CareField;
  token: string;
  recipientId?: string | null;
  value: unknown;
  onChange: (v: unknown) => void;
}

/**
 * A file sent straight from the person's phone into private Care storage.
 * Nothing is public: the questionnaire only ever holds the file's name and
 * where it was put.
 */
export const CareUploadAnswer = ({ field, token, recipientId, value, onChange }: UploadProps) => {
  const files = entries(value);
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async (file: File) => {
    setProblem(null);
    const ok = /\.(pdf|jpe?g|png|heic)$/i.test(file.name);
    if (!ok) {
      setProblem("Please send a PDF or a photo (JPG, PNG or HEIC).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setProblem("That file is larger than 15MB. Please send a smaller one.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("token", token);
    form.append("field", field.id);
    if (recipientId) form.append("recipient_id", recipientId);
    form.append("file", file);
    const { data, error } = await supabase.functions.invoke("care-file-upload", { body: form });
    setBusy(false);
    if (error || !data?.ok) {
      setProblem("That did not reach us. Please try again, or bring the document to the visit.");
      return;
    }
    // The answer holds the reference the server issued, never a storage path.
    onChange([...files, { id: data.id, name: file.name }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {files.map((f, index) => (
        <div key={`${String(f.id ?? index)}`} className="flex items-center justify-between gap-3 border border-line bg-white p-3">

          <p className="text-[15px] leading-snug text-ink">{String(f.name ?? "Document")}</p>
          <button
            type="button"
            className={removeButton}
            aria-label={`Remove ${String(f.name ?? "document")}`}
            onClick={() => {
              const next = files.filter((_, i) => i !== index);
              onChange(next.length ? next : null);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <input
        ref={input}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(chip, chipOff, "inline-flex w-auto items-center gap-2 self-start")}
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {busy ? "Sending" : files.length ? "Add another file" : "Choose a file"}
      </button>
      <p className="text-[15px] leading-relaxed text-body">
        PDF files or photographs (JPG, PNG or HEIC), up to 15MB each. Only the care team can see them.
      </p>
      {problem && <p className="text-[15px] font-bold leading-relaxed text-destructive">{problem}</p>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Choosing from the medicines already entered                         */
/* ------------------------------------------------------------------ */
//
// A follow-up about the medicines already listed is answered by choosing from
// that list, not by writing the names again. Nothing appears here that the
// person has not already recorded themselves.

interface MedicineChoiceProps {
  /** The entries of the medicine question this follow-up reads. */
  source: unknown;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** The stable key one medicine entry is chosen by. */
export const medicineKey = (entry: Record<string, unknown>): string =>
  entry.code ? String(entry.code) : `other:${String(entry.other ?? "").trim().toLowerCase()}`;

export const MedicineChoiceAnswer = ({ source, value, onChange }: MedicineChoiceProps) => {
  const { terms } = CLINICAL_LISTS.medicine;
  const listed = entries(source);
  const chosen = Array.isArray(value) ? value.map((v) => String(v)) : [];

  if (listed.length === 0) {
    return (
      <p className="text-[15px] leading-relaxed text-body">
        Add the medicines above first, then choose from them here.
      </p>
    );
  }

  const toggle = (key: string) => {
    const next = chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key];
    onChange(next.length ? next : null);
  };

  return (
    <div className="flex flex-col gap-2">
      {listed.map((entry) => {
        const key = medicineKey(entry);
        const named = entry.code ? clinicalLabel(terms, String(entry.code)) : String(entry.other ?? "");
        const selected = chosen.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(key)}
            className={cn(chip, "w-full", selected ? chipOn : chipOff)}
          >
            {named}
          </button>
        );
      })}
    </div>
  );
};
