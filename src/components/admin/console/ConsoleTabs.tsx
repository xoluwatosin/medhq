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
    className="mb-5 flex gap-1 overflow-x-auto border-b-2 border-navy [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            "min-h-11 shrink-0 bg-transparent px-3.5 text-sm font-bold text-navy/70 transition-colors hover:bg-tint hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isActive && "bg-navy text-white hover:bg-navy hover:text-white",
          )}
        >
          {tab.label}
          {!!tab.count && <span className={cn("ml-2 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums", isActive ? "bg-white text-navy" : "bg-tint text-navy")}>{tab.count}</span>}
        </button>
      );
    })}
  </div>
);

export default ConsoleTabs;
