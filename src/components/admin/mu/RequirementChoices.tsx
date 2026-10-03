// Requirements as choices, not prose.
//
// Every control here writes to a column the shortlist actually filters or
// scores on, so what the office picks is exactly what the database ranks. Free
// text stays available for context, but it is never the only way to state a
// requirement.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PROFESSIONS } from "@/lib/professions";
import { CARE_TYPES, SHIFT_PATTERNS } from "@/lib/work-preferences";

export interface RequirementChoiceValue {
  match_professions: string[] | null;
  match_care_types: string[] | null;
  match_shift_patterns: string[] | null;
  match_live_in: string | null;
  match_min_years: number | null;
}

export const LIVE_IN_REQUIREMENT: { code: string; label: string }[] = [
  { code: "any", label: "Either suits the client" },
  { code: "live_in", label: "Live-in required" },
  { code: "live_out", label: "Live-out required" },
];

const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn(
      "border px-3 py-1.5 text-xs font-medium transition-colors",
      on
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
    )}
  >
    {label}
  </button>
);

const Group = ({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {help ? <p className="mt-0.5 text-xs text-muted-foreground">{help}</p> : null}
    </div>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const toggle = (list: string[] | null, code: string): string[] => {
  const cur = list ?? [];
  return cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
};

interface Props {
  value: RequirementChoiceValue;
  onChange: (next: Partial<RequirementChoiceValue>) => void;
  /** Hide the professions block where the role already fixes it. */
  showProfessions?: boolean;
  compact?: boolean;
}

const RequirementChoices = ({ value, onChange, showProfessions = true, compact = false }: Props) => (
  <div className={cn("space-y-5", compact && "space-y-4")}>
    {showProfessions && (
      <Group label="Profession" help="Only these professions are ranked. Leave empty and every profession is in scope.">
        {PROFESSIONS.map((p) => (
          <Chip
            key={p}
            label={p}
            on={(value.match_professions ?? []).includes(p)}
            onClick={() => onChange({ match_professions: toggle(value.match_professions, p) })}
          />
        ))}
      </Group>
    )}

    <Group label="Type of care" help="Matched against what each candidate has said they will take on.">
      {CARE_TYPES.map((c) => (
        <Chip
          key={c.code}
          label={c.label}
          on={(value.match_care_types ?? []).includes(c.code)}
          onClick={() => onChange({ match_care_types: toggle(value.match_care_types, c.code) })}
        />
      ))}
    </Group>

    <Group label="Shift patterns" help="A candidate who has ruled out these shifts is excluded.">
      {SHIFT_PATTERNS.map((s) => (
        <Chip
          key={s.code}
          label={s.label}
          on={(value.match_shift_patterns ?? []).includes(s.code)}
          onClick={() => onChange({ match_shift_patterns: toggle(value.match_shift_patterns, s.code) })}
        />
      ))}
    </Group>

    <div className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Living arrangement</label>
        <Select
          value={value.match_live_in ?? "any"}
          onValueChange={(v) => onChange({ match_live_in: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LIVE_IN_REQUIREMENT.map((o) => (
              <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Least experience accepted</label>
        <Select
          value={value.match_min_years == null ? "none" : String(value.match_min_years)}
          onValueChange={(v) => onChange({ match_min_years: v === "none" ? null : Number(v) })}
        >
          <SelectTrigger><SelectValue placeholder="Not stated" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not stated</SelectItem>
            <SelectItem value="0">No minimum</SelectItem>
            <SelectItem value="1">At least one year</SelectItem>
            <SelectItem value="2">At least two years</SelectItem>
            <SelectItem value="3">At least three years</SelectItem>
            <SelectItem value="5">At least five years</SelectItem>
            <SelectItem value="10">At least ten years</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
);

export default RequirementChoices;
