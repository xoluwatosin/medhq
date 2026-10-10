import { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PinNote } from "@/components/mc/brand";

/**
 * A long legal page: the prose, with a contents rail beside it on wide
 * screens and a fold-out list on a phone. The rail is read from the page's
 * own numbered h2 headings, so it never drifts from the text.
 */
type Entry = { id: string; num: string; label: string };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const Contents = ({ entries, onPick }: { entries: Entry[]; onPick?: () => void }) => (
  <ol className="flex flex-col">
    {entries.map((e) => (
      <li key={e.id}>
        <a
          href={`#${e.id}`}
          onClick={onPick}
          className="group flex min-h-11 items-center gap-3 border-b border-tint py-1.5 text-[14.5px] font-bold leading-snug text-ink hover:text-brand"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-navy text-[12px] font-extrabold tabular-nums text-white group-hover:bg-brand">
            {e.num}
          </span>
          {e.label}
        </a>
      </li>
    ))}
  </ol>
);

const KitLegal = ({ children, note }: { children: ReactNode; note?: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const found: Entry[] = [];
    ref.current?.querySelectorAll("h2").forEach((h) => {
      const text = h.textContent?.trim() ?? "";
      const m = text.match(/^(\d+)\.\s*(.*)$/);
      const label = m ? m[2] : text;
      const id = h.id || slug(label);
      h.id = id;
      h.style.scrollMarginTop = "110px";
      found.push({ id, num: m ? m[1] : "", label });
    });
    setEntries(found);
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
      <aside className="lg:sticky lg:top-[120px] lg:self-start">
        <div className="lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-12 w-full items-center justify-between border-2 border-navy bg-card px-4 text-[15px] font-extrabold text-navy shadow-offset-sm"
          >
            On this page
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open && <div className="mt-3"><Contents entries={entries} onPick={() => setOpen(false)} /></div>}
        </div>
        <div className="hidden lg:block">
          <p className="eyebrow">On this page</p>
          <div className="mt-3"><Contents entries={entries} /></div>
          {note && <PinNote className="mt-8" tilt={-1.5}>{note}</PinNote>}
        </div>
      </aside>
      <div ref={ref} className="kit-prose">{children}</div>
    </div>
  );
};

export default KitLegal;
