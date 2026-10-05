// What is filtering this list, at a glance: one removable chip per active
// filter, "Clear all", and how many rows are showing.
import { X } from "lucide-react";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export const FilterChips = ({
  filters,
  onClearAll,
  shown,
  total,
  noun = "results",
}: {
  filters: ActiveFilter[];
  onClearAll: () => void;
  shown?: number;
  total?: number;
  noun?: string;
}) => {
  if (!filters.length && shown === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
      {shown !== undefined && (
        <span className="mr-1 font-medium text-foreground">
          Showing {shown}
          {total !== undefined && total !== shown ? ` of ${total}` : ""} {noun}
        </span>
      )}
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={f.onRemove}
          className="inline-flex min-h-[32px] items-center gap-1.5 border border-navy/30 bg-tint px-2.5 text-[13px] font-semibold text-navy hover:border-navy"
          aria-label={`Remove filter ${f.label}`}
        >
          {f.label}
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
      {filters.length > 0 && (
        <button type="button" onClick={onClearAll} className="min-h-[32px] px-1 text-[13px] font-semibold text-brand underline-offset-2 hover:underline">
          Clear all
        </button>
      )}
    </div>
  );
};

export default FilterChips;
