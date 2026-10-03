// Languages on a client record, chosen from the canonical Care list and held
// as stable codes. There is no free-text path: what is stored is always a
// language the rest of Care can read back.
import { X } from "lucide-react";
import { SearchableSelect } from "@/components/field";
import { LANGUAGE_TERMS, languageLabel } from "@/lib/care-vocabularies";

interface Props {
  label: string;
  help?: string;
  value: string[];
  onChange: (codes: string[]) => void;
}

const LanguageCodes = ({ label, help, value, onChange }: Props) => {
  const remaining = LANGUAGE_TERMS
    .filter((t) => !value.includes(t.code))
    .map((t) => ({ value: t.code, label: t.label }));

  return (
    <div className="w-full">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onChange(value.filter((c) => c !== code))}
              className="inline-flex items-center gap-1.5 border border-line bg-desk px-2.5 py-1 text-[13px] font-semibold text-ink"
            >
              {languageLabel(code)}
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Remove {languageLabel(code)}</span>
            </button>
          ))}
        </div>
      )}
      <SearchableSelect
        label={label}
        help={help}
        value=""
        placeholder={value.length ? "Add another language" : "Choose a language"}
        onChange={(code) => {
          if (code && !value.includes(code)) onChange([...value, code]);
        }}
        options={remaining}
      />
    </div>
  );
};

export default LanguageCodes;
