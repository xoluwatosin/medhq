// Authenticated address autocomplete routed through the backend so it works
// consistently on the preview, published app and custom domains.
import { useEffect, useId, useRef, useState } from "react";
import { cxInputClass } from "@/components/candidate/primitives";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Suggestion {
  id: string;
  formattedAddress: string;
  mainText: string;
  secondaryText: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const AddressAutocomplete = ({ value, onChange, placeholder, className }: Props) => {
  const id = useId();
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = async (text: string) => {
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const requestId = ++requestRef.current;
    const { data, error } = await supabase.functions.invoke("address-autocomplete", {
      body: { input: text.trim() },
    });
    if (requestId !== requestRef.current) return;
    if (error) {
      console.error("Address autocomplete failed", error);
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const next = Array.isArray(data?.suggestions) ? data.suggestions as Suggestion[] : [];
    setSuggestions(next);
    setOpen(next.length > 0);
  };

  // One lookup per pause in typing, not one per keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSuggestions = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);


  const select = (s: Suggestion) => {
    setInput(s.formattedAddress);
    onChange(s.formattedAddress);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          setInput(v);
          onChange(v);
          queueSuggestions(v);
        }}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        placeholder={placeholder}
        className={cn(cxInputClass(), className)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto border border-line bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s)}
                className="w-full px-4 py-3 text-left text-[14.5px] leading-snug text-ink hover:bg-desk"
              >
                <span className="font-semibold">{s.mainText}</span>
                {s.secondaryText && <span className="block text-[13px] text-body">{s.secondaryText}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
