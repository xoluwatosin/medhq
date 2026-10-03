// Languages, chosen from a list as you type. Chips for what is already picked,
// suggestions underneath. There is no free-text path, so what we store always
// matches a language we can match on.
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchLanguages } from "@/lib/languages";

interface Props {
  /** Comma separated list, so it slots straight into the answer plumbing. */
  value: string;
  onChange: (value: string) => void;
}

const LanguagePicker = ({ value, onChange }: Props) => {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const chosen = useMemo(
    () => value.split(",").map((t) => t.trim()).filter(Boolean),
    [value],
  );
  const suggestions = useMemo(() => searchLanguages(query, chosen), [query, chosen]);

  const add = (language: string) => {
    if (chosen.some((c) => c.toLowerCase() === language.toLowerCase())) return;
    onChange([...chosen, language].join(", "));
    setQuery("");
  };

  const remove = (language: string) =>
    onChange(chosen.filter((c) => c !== language).join(", "));

  return (
    <div className="w-full">
      {chosen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => remove(c)}
              className="inline-flex items-center gap-1.5 border border-border bg-muted px-2.5 py-1 text-[13px] font-semibold text-foreground"
            >
              {c}
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Remove {c}</span>
            </button>
          ))}
        </div>
      )}

      <Input
        value={query}
        placeholder={chosen.length ? "Add another language" : "Start typing a language"}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setFocused(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (suggestions[0]) add(suggestions[0]);
          }
        }}
      />

      {focused && suggestions.length > 0 && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto border border-border bg-background">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
                className="flex w-full px-3 py-2.5 text-left text-[14.5px] hover:bg-muted"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen.length === 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Pick every language you can hold a conversation in.
        </p>
      )}
    </div>
  );
};

export default LanguagePicker;
