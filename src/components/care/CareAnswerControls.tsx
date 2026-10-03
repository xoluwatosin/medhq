// The controls a professional record needs that a plain form does not: a
// measurement that always carries its unit, a repeatable item validated entry
// by entry, a matrix of support levels, and a weekly pattern.
//
// Every one of these stores a single value for one question, so the offline
// event queue, the record renderer and the server all keep treating a question
// as a question.
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cxInputClass } from "@/components/candidate/primitives";
import { TimeField } from "@/components/field";
import { readClinicalEntries, RELATIONSHIPS, RELATIONSHIP_OTHER } from "@/lib/care";
import type { CareField, CareOption } from "@/lib/care";

const chosenLook = "border-[1.5px] border-navy bg-tint font-bold text-navy";
const restingLook = "border border-line bg-white text-ink hover:bg-desk/60";

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asEntries = (value: unknown): Record<string, string>[] =>
  Array.isArray(value) ? (value as Record<string, string>[]) : [];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const MeasurementAnswer = ({
  field, value, onChange,
}: { field: CareField; value: unknown; onChange: (v: unknown) => void }) => {
  const current = asObject(value);
  const set = (key: string, next: string) => {
    const merged = { ...current, [key]: next === "" ? null : Number(next) };
    const empty = Object.values(merged).every((v) => v === null || v === undefined || v === "");
    onChange(empty ? null : merged);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(field.measures ?? []).map((measure) => (
        <label key={measure.key} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-ink2">{measure.label}</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              className={cxInputClass()}
              value={current[measure.key] === null || current[measure.key] === undefined
                ? "" : String(current[measure.key])}
              onChange={(e) => set(measure.key, e.target.value)}
            />
            <span className="shrink-0 text-[13.5px] text-ink2">{measure.unit}</span>
          </span>
        </label>
      ))}
    </div>
  );
};

/**
 * Every entry carries its own reference, made once when the entry is added.
 * A held event replayed twice therefore lands on the same entry: a medicine,
 * a wound or a contact can never be recorded twice by a sync.
 */
const entryReference = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `e${Date.now()}${Math.random().toString(36).slice(2, 8)}`);

export const RepeatableAnswer = ({
  field, value, onChange,
}: { field: CareField; value: unknown; onChange: (v: unknown) => void }) => {
  const entries = asEntries(value);
  const parts = field.items ?? [];

  const update = (index: number, part: string, next: string) => {
    const copy = entries.map((entry, i) => (i === index ? { ...entry, [part]: next } : entry));
    onChange(copy);
  };
  const remove = (index: number) => {
    const copy = entries.filter((_, i) => i !== index);
    onChange(copy.length ? copy : null);
  };

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        <div key={entry.__id ?? index} className="cx-chip border border-line bg-white p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-bold text-ink2">Entry {index + 1}</p>
            <button
              type="button"
              onClick={() => remove(index)}
              className="flex min-h-11 items-center gap-1 text-[13.5px] font-bold text-ink2"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {parts.map((part) => (
              <label key={part} className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[13px] font-bold text-ink2">{part}</span>
                <input
                  className={cxInputClass()}
                  value={entry[part] ?? ""}
                  onChange={(e) => update(index, part, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([
          ...entries,
          { __id: entryReference(), ...Object.fromEntries(parts.map((p) => [p, ""])) },
        ])}
        className="cx-control flex min-h-11 items-center justify-center gap-2 border border-dashed border-line px-4 py-3 text-[14.5px] font-bold text-navy"
      >
        <Plus aria-hidden className="h-4 w-4" />
        Add an entry
      </button>
    </div>
  );
};


export const MatrixAnswer = ({
  field, options, value, onChange,
}: { field: CareField; options: CareOption[]; value: unknown; onChange: (v: unknown) => void }) => {
  const current = asObject(value) as Record<string, string>;
  const set = (row: string, next: string) => {
    const merged = { ...current, [row]: next };
    if (current[row] === next) delete merged[row];
    onChange(Object.keys(merged).length ? merged : null);
  };

  return (
    <div className="flex flex-col gap-3">
      {(field.rows ?? []).map((row) => (
        <div key={row} className="flex min-w-0 flex-col gap-2">
          <p className="text-[14px] font-bold text-ink">{row}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = current[row] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set(row, option.value)}
                  className={cn(
                    "cx-chip min-h-11 px-3.5 py-2 text-[14px] transition-colors",
                    selected ? chosenLook : restingLook,
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export const WeeklyPatternAnswer = ({
  options, value, onChange,
}: { options: CareOption[]; value: unknown; onChange: (v: unknown) => void }) => {
  const current = asObject(value) as Record<string, string[]>;
  const toggle = (day: string, slot: string) => {
    const chosen = Array.isArray(current[day]) ? current[day] : [];
    const next = chosen.includes(slot) ? chosen.filter((s) => s !== slot) : [...chosen, slot];
    const merged = { ...current, [day]: next };
    if (next.length === 0) delete merged[day];
    onChange(Object.keys(merged).length ? merged : null);
  };

  return (
    <div className="flex flex-col gap-3">
      {DAYS.map((day) => (
        <div key={day} className="flex min-w-0 flex-col gap-2">
          <p className="text-[14px] font-bold text-ink">{day}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = (current[day] ?? []).includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(day, option.value)}
                  className={cn(
                    "cx-chip min-h-11 px-3.5 py-2 text-[14px] transition-colors",
                    selected ? chosenLook : restingLook,
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ---------- grouped choices, a clock time and one person's details -------- */

/**
 * Choices offered under headings, so a long list is scanned rather than read.
 * The codes chosen and the words a person writes themselves are held apart:
 * nothing typed is ever turned into a code.
 */
export const TagListAnswer = ({
  field, value, responses, onChange,
}: {
  field: CareField;
  value: unknown;
  /** Answers already given, so anything recorded earlier can be shown here. */
  responses?: Record<string, unknown>;
  onChange: (v: unknown) => void;
}) => {
  const current = asObject(value);
  // Where this list names an earlier question, what was recorded there is shown
  // beside it so the same thing is not entered twice.
  const alreadyRecorded = field.source
    ? readClinicalEntries("allergy_list", Array.isArray((responses ?? {})[field.source])
      ? ((responses ?? {})[field.source] as unknown[])
      : [])
    : "";
  const codes = Array.isArray(current.codes) ? (current.codes as string[]) : [];
  const other = typeof current.other === "string" ? current.other : "";

  const commit = (nextCodes: string[], nextOther: string) => {
    const empty = nextCodes.length === 0 && !nextOther.trim();
    onChange(empty ? null : { codes: nextCodes, other: nextOther.trim() ? nextOther : undefined });
  };

  return (
    <div className="flex flex-col gap-4">
      {alreadyRecorded && (
        <div className="cx-control border border-line bg-desk/60 px-3.5 py-3">
          <p className="text-[13px] font-bold text-ink2">Allergies already recorded</p>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{alreadyRecorded}</p>
        </div>
      )}
      {(field.groups ?? []).map((group) => (
        <div key={group.label} className="flex min-w-0 flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wide text-ink2">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const selected = codes.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => commit(
                    selected ? codes.filter((c) => c !== option.value) : [...codes, option.value],
                    other,
                  )}
                  className={cn(
                    "cx-chip min-h-11 px-3.5 py-2 text-[14px] transition-colors",
                    selected ? chosenLook : restingLook,
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-ink2">Anything else, in your own words</span>
        <input
          className={cxInputClass()}
          value={other}
          onChange={(e) => commit(codes, e.target.value)}
        />
      </label>
    </div>
  );
};

/** A clock time, recorded as HH:MM. */
export const TimeAnswer = ({
  field, value, onChange,
}: { field: CareField; value: unknown; onChange: (v: unknown) => void }) => (
  <TimeField
    label={field.record}
    hideLabel
    value={typeof value === "string" ? value : ""}
    className="w-full"
    onChange={(next) => onChange(next || null)}
  />
);

const CONTACT_PARTS = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phone", label: "Phone number" },
  { key: "email", label: "Email address" },
] as const;

const sameName = (a: string, b: string) =>
  a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/** One person's details, asked together rather than one box at a time. */
export const ContactBlockAnswer = ({
  field, value, knownPeople, onChange,
}: {
  field?: CareField;
  value: unknown;
  /** People this request already holds, so the same person is not added twice. */
  knownPeople?: { name: string; role: string }[];
  onChange: (v: unknown) => void;
}) => {
  const current = asObject(value) as Record<string, string | undefined>;
  const set = (key: string, next: string) => {
    const merged = { ...current, [key]: next };
    const empty = Object.values(merged).every((v) => !String(v ?? "").trim());
    onChange(empty ? null : merged);
  };
  const relationship = current.relationship ?? "";
  const requiredParts = field?.requiredParts ?? [];
  const started = Object.values(current).some((v) => String(v ?? "").trim());
  const entered = [current.firstName, current.lastName].filter(Boolean).join(" ").trim();
  const duplicate = entered
    ? (knownPeople ?? []).find((p) => sameName(p.name, entered))
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {CONTACT_PARTS.map((part) => {
          const needed = started
            && requiredParts.includes(part.key)
            && !String(current[part.key] ?? "").trim();
          return (
            <label key={part.key} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ink2">{part.label}</span>
              <input
                className={cxInputClass()}
                aria-invalid={needed || undefined}
                inputMode={part.key === "phone" ? "tel" : part.key === "email" ? "email" : "text"}
                value={current[part.key] ?? ""}
                onChange={(e) => set(part.key, e.target.value)}
              />
              {needed && <span className="text-[13px] text-destructive">This is needed</span>}
            </label>
          );
        })}
      </div>
      {duplicate && (
        <p className="text-[13px] leading-relaxed text-ink2">
          {entered} is already recorded on this request as {duplicate.role}. Give someone else, or
          leave this out.
        </p>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[13px] font-bold text-ink2">Relationship to the person receiving care</p>
        <div className="flex flex-wrap gap-2">
          {[...RELATIONSHIPS, RELATIONSHIP_OTHER].slice(0, 200).map((option) => {
            const selected = relationship === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => set("relationship", selected ? "" : option)}
                className={cn(
                  "cx-chip min-h-11 px-3.5 py-2 text-[14px] transition-colors",
                  selected ? chosenLook : restingLook,
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
        {started && requiredParts.includes("relationship") && !relationship && (
          <span className="text-[13px] text-destructive">This is needed</span>
        )}
        {relationship === RELATIONSHIP_OTHER && (
          <input
            className={cxInputClass()}
            placeholder="How they are related"
            value={current.relationshipOther ?? ""}
            onChange={(e) => set("relationshipOther", e.target.value)}
          />
        )}
      </div>
    </div>
  );
};
