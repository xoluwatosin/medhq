import { ReactNode } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The phone half of the console list contract. Desktop keeps its table
 * (`hidden md:block`); phones get one operational row per record: a title,
 * one line of state, an optional status, and a tap target that is the whole
 * row. Not a card disguise: no stacked label/value grids, no shadows, just
 * the information needed to decide which record to open.
 */
export interface ConsoleMobileRow {
  key: string;
  title: ReactNode;
  /** One quiet line under the title: state, source, timing. */
  state?: ReactNode;
  /** Chip or short status on the right. */
  status?: ReactNode;
  /** Opens the record. Whole row becomes the control. */
  onOpen?: () => void;
  /** Alternative to onOpen for route-backed records. */
  to?: string;
  /** Extra controls that must stay reachable without opening the record. */
  trailing?: ReactNode;
}

interface ConsoleMobileListProps {
  rows: readonly ConsoleMobileRow[];
  emptyLabel: string;
  emptyIcon?: LucideIcon;
  className?: string;
}

const RowBody = ({ row }: { row: ConsoleMobileRow }) => (
  <>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-navy">{row.title}</span>
      {row.state && <span className="mt-0.5 block text-[13px] leading-snug text-muted-copy">{row.state}</span>}
    </span>
    {row.status && <span className="flex shrink-0 items-center gap-2 self-center">{row.status}</span>}
    {row.trailing && <span className="flex shrink-0 items-center gap-1 self-center">{row.trailing}</span>}
    {(row.onOpen || row.to) && !row.trailing && (
      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-copy/50" aria-hidden />
    )}
  </>
);

const ConsoleMobileList = ({ rows, emptyLabel, emptyIcon: EmptyIcon, className }: ConsoleMobileListProps) => (
  <div className={cn("border border-line-soft bg-card md:hidden", className)}>
    {rows.length === 0 ? (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        {EmptyIcon && (
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-grey-pill text-muted-copy">
            <EmptyIcon className="h-4 w-4" />
          </span>
        )}
        <p className="text-sm font-medium text-navy">{emptyLabel}</p>
      </div>
    ) : (
      <ul className="divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.key}>
            {row.to ? (
              <Link
                to={row.to}
                className="flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none"
              >
                <RowBody row={row} />
              </Link>
            ) : row.onOpen ? (
              <button
                type="button"
                onClick={row.onOpen}
                className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background focus-visible:bg-background focus-visible:outline-none"
              >
                <RowBody row={row} />
              </button>
            ) : (
              <div className="flex min-h-[60px] items-center gap-3 px-4 py-3">
                <RowBody row={row} />
              </div>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default ConsoleMobileList;
