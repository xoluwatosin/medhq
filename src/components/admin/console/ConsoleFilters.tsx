import { cn } from "@/lib/utils";

export interface ConsoleFilter {
  id: string;
  label: string;
  count?: number;
  /** Shown in the warning colour, for the view where the day starts. */
  urgent?: boolean;
}

interface ConsoleFiltersProps {
  filters: readonly ConsoleFilter[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  controls?: string;
}

/**
 * One row of filter chips that wraps onto a second line instead of scrolling,
 * so every view and its count is visible at once.
 */
const ConsoleFilters = ({ filters, active, onChange, label, controls }: ConsoleFiltersProps) => (
  <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={label}>
    {filters.map((filter) => {
      const isActive = active === filter.id;
      return (
        <button
          key={filter.id}
          type="button"
          aria-pressed={isActive}
          aria-controls={controls}
          onClick={() => onChange(filter.id)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 border px-3 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isActive
              ? "border-navy bg-navy text-white"
              : filter.urgent
                ? "border-warn-ink/40 bg-warn-bg text-warn-ink hover:border-warn-ink"
                : "border-line bg-card text-navy hover:border-navy",
          )}
        >
          {filter.label}
          {filter.count !== undefined && (
            <span className={cn("text-[11px] font-extrabold tabular-nums", isActive ? "text-white/80" : "opacity-70")}>
              {filter.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default ConsoleFilters;
