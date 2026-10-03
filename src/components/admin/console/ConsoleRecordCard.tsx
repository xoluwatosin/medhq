import { ReactNode } from "react";

export interface ConsoleRecordField {
  key: string;
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

interface ConsoleRecordCardProps {
  title: string;
  subtitle?: string;
  fields: readonly ConsoleRecordField[];
  footer?: ReactNode;
}

const ConsoleRecordCard = ({ title, subtitle, fields, footer }: ConsoleRecordCardProps) => (
  <article className="border border-line-soft bg-card">
    <div className="border-b border-line-soft bg-grey-pill px-4 py-3">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted-copy">{subtitle}</p>}
    </div>
    <dl className="grid grid-cols-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {fields.map((field, index) => (
        <div
          key={field.key}
          className={
            field.fullWidth
              ? "border-b border-line-soft px-4 py-3 sm:col-span-2"
              : index % 2 === 0
                ? "border-b border-line-soft px-4 py-3 sm:border-r"
                : "border-b border-line-soft px-4 py-3"
          }
        >
          <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-copy">{field.label}</dt>
          <dd className="mt-1.5 text-body">{field.value}</dd>
        </div>
      ))}
    </dl>
    {footer && <div className="border-t border-line-soft p-3">{footer}</div>}
  </article>
);

export default ConsoleRecordCard;
