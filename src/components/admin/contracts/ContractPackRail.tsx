// The left rail of the contract editor: every document in the pack, in the
// order the candidate will meet them, with where each one stands.
//
// Clicking a document puts it on the canvas. The rail collapses to a strip so
// the writing surface can take the screen, and the choice is remembered.
import { Check, ChevronLeft, ChevronRight, FileSignature, FileText, FileStack, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PackRailEntry {
  /** "letter" for the offer letter, otherwise the annex index as a string. */
  key: string;
  code?: string | null;
  title: string;
  status: string;
  done: boolean;
  /** Included in the issued pack. */
  included: boolean;
  requiresSignature?: boolean;
}

interface Props {
  entries: PackRailEntry[];
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  editable: boolean;
  onAddAnnex: () => void;
  onUseTemplate: () => void;
  templateCount: number;
}

const ContractPackRail = ({
  entries,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapsed,
  editable,
  onAddAnnex,
  onUseTemplate,
  templateCount,
}: Props) => {
  if (collapsed) {
    return (
      <>
        {/* Phones: a stacked list rather than a squeezed icon strip. */}
        <div className="flex w-full flex-col gap-2 rounded-2xl border border-border/60 bg-background p-3 sm:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The pack</p>
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Show the pack"
              title="Show the pack"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.key)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                    activeKey === entry.key
                      ? "border-primary/50 bg-primary/5"
                      : "border-transparent hover:bg-muted/50",
                    !entry.included && "opacity-50",
                  )}
                >
                  {entry.requiresSignature ? (
                    <FileSignature className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.title}</span>
                  {entry.done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" />}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* sm+: the collapsed icon strip. */}
        <div className="hidden w-10 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background py-3 sm:flex">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Show the pack"
            title="Show the pack"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="h-px w-6 bg-border/60" />
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => onSelect(entry.key)}
              title={entry.title}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center rounded-lg",
                activeKey === entry.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                !entry.included && "opacity-40",
              )}
            >
              {entry.requiresSignature ? <FileSignature className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <aside className="w-60 shrink-0 space-y-3 rounded-2xl border border-border/60 bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The pack</p>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Hide the pack"
          title="Hide the pack"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              onClick={() => onSelect(entry.key)}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left transition",
                activeKey === entry.key
                  ? "border-primary/50 bg-primary/5"
                  : "border-transparent hover:bg-muted/50",
                !entry.included && "opacity-50",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-medium leading-snug">
                  {entry.code ? <span className="text-muted-foreground">{entry.code} · </span> : null}
                  {entry.title}
                </span>
                {entry.done && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {entry.included ? entry.status : "Left out of this pack"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editable && (
        <div className="space-y-1.5 border-t border-border/60 pt-2.5">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={onAddAnnex}>
            <Plus className="mr-2 h-4 w-4" />Add an annex
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onUseTemplate}
            disabled={templateCount === 0}
          >
            <FileStack className="mr-2 h-4 w-4" />Use a template
          </Button>
        </div>
      )}
    </aside>
  );
};

export default ContractPackRail;
