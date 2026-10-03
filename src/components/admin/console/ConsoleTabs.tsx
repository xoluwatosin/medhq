import { cn } from "@/lib/utils";

export interface ConsoleTab {
  id: string;
  label: string;
  count?: number;
}

interface ConsoleTabsProps {
  tabs: readonly ConsoleTab[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  controls?: string;
}

const ConsoleTabs = ({ tabs, active, onChange, label, controls }: ConsoleTabsProps) => (
  <div
    className="mb-1.5 flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    role="tablist"
    aria-label={label}
  >
    {tabs.map((tab) => {
      const isActive = active === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          aria-controls={controls}
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-11 shrink-0 border-b-2 border-transparent bg-transparent px-0 pb-2 pt-1 text-sm font-medium text-muted-copy transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isActive && "border-navy font-semibold text-ink",
          )}
        >
          {tab.label}
          {!!tab.count && <span className="ml-2 text-xs text-muted-copy">{tab.count}</span>}
        </button>
      );
    })}
  </div>
);

export default ConsoleTabs;
