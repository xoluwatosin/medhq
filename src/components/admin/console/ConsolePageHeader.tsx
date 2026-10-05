import { ReactNode } from "react";

interface ConsolePageHeaderProps {
  title: string;
  description?: string;
  id?: string;
  /** Optional single control that belongs to the page, such as Add client. */
  action?: ReactNode;
}

const ConsolePageHeader = ({ title, description, id, action }: ConsolePageHeaderProps) => (
  <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 id={id} className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-navy sm:text-[30px]">
        {title}
      </h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

export default ConsolePageHeader;
