// Layout furniture for the candidate portal.
//
// One header, one row of progress tiles, titled sections. Candidates see three
// things only: what we need from them, what we hold, and when they are free.
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const PortalSection = ({
  title,
  description,
  actions,
  children,
  padded = true,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) => (
  <section className={cn("rounded-2xl border border-border/70 bg-card", className)}>
    {(title || actions) && (
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {title && <h2 className="font-serif text-base font-bold tracking-tight">{title}</h2>}
          {description && <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn(padded && "p-5")}>{children}</div>
  </section>
);

export const PortalTile = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "attention" | "good";
  onClick?: () => void;
}) => {
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn(
        "w-full rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors",
        tone === "attention" && "border-destructive/30 bg-destructive/[0.04]",
        tone === "good" && "border-primary/30 bg-primary/[0.04]",
        onClick && "hover:border-primary/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-sm leading-snug text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
              tone === "attention" && "bg-destructive/10 text-destructive",
              tone === "good" && "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
    </Tag>
  );
};


export const PortalEmpty = ({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
    {Icon && (
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
    )}
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>}
  </div>
);
