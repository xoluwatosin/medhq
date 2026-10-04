import { Link } from "react-router-dom";
import Status from "@/components/field/Status";
import { STATUS_CLASS, STATUS_SHORT_LABEL, STATUS_TONE, type HealthStatus } from "@/lib/system-health";
import { cn } from "@/lib/utils";

interface HealthStripProps {
  areas: { key: string; label: string; status: HealthStatus }[];
  /** Tiles link to the System health screen, e.g. from the Overview. */
  linked?: boolean;
  className?: string;
}

/** One tile per area: green, amber or red, always said in words too. */
const HealthStrip = ({ areas, linked, className }: HealthStripProps) => (
  <ul className={cn("grid grid-cols-2 gap-px border border-line-soft bg-line-soft sm:grid-cols-3 lg:grid-cols-6", className)}>
    {areas.map((area) => {
      const body = (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-copy">{area.label}</p>
          <Status
            label={STATUS_SHORT_LABEL[area.status]}
            tone={STATUS_TONE[area.status]}
            className={cn("mt-2", STATUS_CLASS[area.status])}
          />
        </>
      );
      return (
        <li key={area.key} className="bg-card">
          {linked ? (
            <Link to="/admin/system" className="block min-h-[76px] px-3 py-3 transition-colors hover:bg-muted/60">
              {body}
            </Link>
          ) : (
            <div className="min-h-[76px] px-3 py-3">{body}</div>
          )}
        </li>
      );
    })}
  </ul>
);

export default HealthStrip;
