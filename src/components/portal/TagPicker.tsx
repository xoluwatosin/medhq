// Pick from the list we match on, with a box for anything the list misses.
// Answers come back as a comma separated line, which is what the profile holds.
import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  /** Human readable options, in the order we want them read. */
  options: readonly string[];
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

const split = (value: string) =>
  value.split(",").map((v) => v.trim()).filter(Boolean);

const TagPicker = ({ options, value, placeholder = "Type anything we have missed", onChange }: Props) => {
  const [other, setOther] = useState("");
  const chosen = useMemo(() => split(value), [value]);
  const known = useMemo(() => new Set(options.map((o) => o.toLowerCase())), [options]);
  const extras = chosen.filter((c) => !known.has(c.toLowerCase()));

  const toggle = (option: string) => {
    const has = chosen.some((c) => c.toLowerCase() === option.toLowerCase());
    const next = has
      ? chosen.filter((c) => c.toLowerCase() !== option.toLowerCase())
      : [...chosen, option];
    onChange(next.join(", "));
  };

  const addOther = () => {
    const text = other.trim();
    if (!text) return;
    if (!chosen.some((c) => c.toLowerCase() === text.toLowerCase())) {
      onChange([...chosen, text].join(", "));
    }
    setOther("");
  };

  return (
    <div className="space-y-3">
      <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto border border-border bg-background p-2.5">
        {options.map((option) => {
          const on = chosen.some((c) => c.toLowerCase() === option.toLowerCase());
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-1.5 border px-2.5 py-1.5 text-[13.5px] transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-body hover:border-primary",
              )}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {option}
            </button>
          );
        })}
      </div>

      {extras.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {extras.map((extra) => (
            <button
              key={extra}
              type="button"
              onClick={() => toggle(extra)}
              className="border border-primary bg-primary px-2.5 py-1.5 text-[13.5px] text-primary-foreground"
            >
              <Check className="mr-1.5 inline h-3.5 w-3.5" />
              {extra}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={other}
          placeholder={placeholder}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addOther(); }
          }}
        />
        <button
          type="button"
          onClick={addOther}
          className="flex h-11 shrink-0 items-center gap-1.5 border border-border px-3 text-[14px] font-semibold text-ink"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
};

export default TagPicker;
