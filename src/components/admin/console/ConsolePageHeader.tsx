import { ReactNode } from "react";

interface ConsolePageHeaderProps {
  title: string;
  description?: string;
  id?: string;
  /** Optional single control that belongs to the page, such as Add client. */
  action?: ReactNode;
}

const ConsolePageHeader = ({ title, description, id, action }: ConsolePageHeaderProps) => (
  <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 id={id} className="text-2xl font-semibold tracking-tight text-navy">
        {title}
      </h1>
      {description && <p className="mt-1 text-xs leading-[1.45] text-muted-copy">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

export default ConsolePageHeader;
