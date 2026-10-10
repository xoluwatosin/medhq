// One place where a Nigerian state or LGA is chosen.
//
// Locations drive deterministic matching, so they must never be typed by hand.
// Every screen that captures a state or an LGA uses these pickers, which read
// from the single dataset in src/lib/nigeria-locations.ts. Anything already on
// file that is not in the dataset is still shown, marked as a legacy value, so
// editing a record never silently discards existing data.
import { useMemo } from "react";
import { X } from "lucide-react";
import { NIGERIA_STATES, getLGAsForState } from "@/lib/nigeria-locations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/** Single state. Empty string means "not set". */
export const StateSelect = ({
  value,
  onChange,
  placeholder = "Select state",
  allowClear = true,
  id,
  className,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  id?: string;
  className?: string;
}) => {
  const current = value ?? "";
  const options = useMemo(
    () => (current && !NIGERIA_STATES.includes(current) ? [current, ...NIGERIA_STATES] : NIGERIA_STATES),
    [current],
  );
  return (
    <Select value={current || undefined} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-popover">
        {allowClear && <SelectItem value={NONE}>Not set</SelectItem>}
        {options.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
            {!NIGERIA_STATES.includes(s) && " (on file)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** Single LGA, narrowed by the state held alongside it. */
export const LgaSelect = ({
  state,
  value,
  onChange,
  allowClear = true,
  id,
  className,
}: {
  state: string | null | undefined;
  value: string | null | undefined;
  onChange: (value: string) => void;
  allowClear?: boolean;
  id?: string;
  className?: string;
}) => {
  const current = value ?? "";
  const list = getLGAsForState(state ?? "");
  const options = useMemo(
    () => (current && !list.includes(current) ? [current, ...list] : list),
    [current, list],
  );

  // No state yet: the same control, waiting, with the reason as its
  // placeholder rather than a sentence dropped into the layout.
  if (!state) {
    return (
      <Select disabled>
        <SelectTrigger id={id} className={className} title="Choose a state first">
          <SelectValue placeholder="Local government (pick a state)" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={current || undefined} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={`Select LGA in ${state}`} />
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-popover">
        {allowClear && <SelectItem value={NONE}>Not set</SelectItem>}
        {options.map((l) => (
          <SelectItem key={l} value={l}>
            {l}
            {!list.includes(l) && " (on file)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const Chips = ({
  values,
  onRemove,
  emptyLabel,
}: {
  values: string[];
  onRemove: (value: string) => void;
  emptyLabel: string;
}) =>
  values.length ? (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1">
          {v}
          <button type="button" onClick={() => onRemove(v)} aria-label={`Remove ${v}`}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  );

/** Many states, held as chips. */
export const StateMultiSelect = ({
  values,
  onChange,
  emptyLabel = "No state set, so location is not filtered.",
  className,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  emptyLabel?: string;
  className?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    <Chips values={values} onRemove={(v) => onChange(values.filter((x) => x !== v))} emptyLabel={emptyLabel} />
    <Select value="" onValueChange={(v) => !values.includes(v) && onChange([...values, v])}>
      <SelectTrigger>
        <SelectValue placeholder="Add a state" />
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-popover">
        {NIGERIA_STATES.filter((s) => !values.includes(s)).map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/**
 * Many LGAs, held as chips. The list is drawn from the states already chosen,
 * so an LGA can never belong to a state that is not part of the same record.
 */
export const LgaMultiSelect = ({
  states,
  values,
  onChange,
  emptyLabel = "No local government set, so the whole state is in scope.",
  className,
}: {
  states: string[];
  values: string[];
  onChange: (values: string[]) => void;
  emptyLabel?: string;
  className?: string;
}) => {
  const pool = useMemo<string[]>(() => {
    const source = states.length ? states : NIGERIA_STATES;
    return Array.from(new Set<string>(source.flatMap((s) => getLGAsForState(s)))).sort();
  }, [states]);

  return (
    <div className={cn("space-y-2", className)}>
      <Chips values={values} onRemove={(v) => onChange(values.filter((x) => x !== v))} emptyLabel={emptyLabel} />
      <Select value="" onValueChange={(v) => !values.includes(v) && onChange([...values, v])}>
        <SelectTrigger>
          <SelectValue placeholder={states.length ? `Add an LGA in ${states.join(", ")}` : "Add an LGA"} />
        </SelectTrigger>
        <SelectContent className="max-h-72 bg-popover">
          {pool
            .filter((l) => !values.includes(l))
            .map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * One text column that still has to hold a place ("Lekki, Lagos"), but is
 * captured with the same controlled lists as everything else. The string is
 * composed as "LGA, State" so existing readers keep working, and the parts are
 * handed back for anything that stores them separately.
 */
export const LocationField = ({
  value,
  onChange,
  className,
}: {
  value: string | null | undefined;
  onChange: (value: string, parts: { state: string; lga: string }) => void;
  className?: string;
}) => {
  const { state, lga } = useMemo(() => parseLocation(value), [value]);
  const set = (nextState: string, nextLga: string) =>
    onChange(composeLocation(nextState, nextLga), { state: nextState, lga: nextLga });

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      <StateSelect value={state} onChange={(s) => set(s, "")} />
      <LgaSelect state={state} value={lga} onChange={(l) => set(state, l)} />
    </div>
  );
};

/** "Lekki, Lagos" -> { state: "Lagos", lga: "Lekki" }. Tolerant of loose text already on file. */
export function parseLocation(value: string | null | undefined): { state: string; lga: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { state: "", lga: "" };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const state = parts.find((p) => NIGERIA_STATES.some((s) => s.toLowerCase() === p.toLowerCase()));
  const matchedState = state ? NIGERIA_STATES.find((s) => s.toLowerCase() === state.toLowerCase())! : "";
  const lgaPool = getLGAsForState(matchedState);
  const lga = parts.find((p) => lgaPool.some((l) => l.toLowerCase() === p.toLowerCase()));
  return {
    state: matchedState,
    lga: lga ? lgaPool.find((l) => l.toLowerCase() === lga.toLowerCase())! : "",
  };
}

export function composeLocation(state: string, lga: string): string {
  return [lga, state].filter(Boolean).join(", ");
}
