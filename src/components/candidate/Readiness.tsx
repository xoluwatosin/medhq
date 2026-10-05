import { cn } from "@/lib/utils";

/**
 * How ready a profile is to be put forward: a count, a bar, and each part as
 * a square that ticks when it is done.
 */
const Readiness = ({ steps, onNavy = false }: { steps: { label: string; done: boolean }[]; onNavy?: boolean }) => {
  const done = steps.filter((s) => s.done).length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className={cn("text-[15px] font-extrabold", onNavy ? "text-white" : "text-navy")}>
          {done === steps.length ? "Ready to be put forward" : `${done} of ${steps.length} done`}
        </p>
        <p className={cn("text-[13px] font-bold tabular-nums", onNavy ? "text-body-navy" : "text-body")}>
          {Math.round((done / steps.length) * 100)}%
        </p>
      </div>
      <div className={cn("mt-2 h-2.5", onNavy ? "bg-white/15" : "bg-tint")}>
        <div className="h-full bg-brand transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {steps.map((s) => (
          <li
            key={s.label}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-[13px] font-extrabold",
              s.done
                ? "bg-brand text-white"
                : onNavy
                  ? "border-2 border-white/30 text-white"
                  : "border-2 border-navy/20 text-navy",
            )}
          >
            <span aria-hidden="true">{s.done ? "✓" : "○"}</span>
            {s.label}
            <span className="sr-only">{s.done ? "done" : "to do"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Readiness;
