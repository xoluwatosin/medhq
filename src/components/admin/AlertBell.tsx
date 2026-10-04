import { Link } from "react-router-dom";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpenAlerts } from "@/hooks/use-open-alerts";
import { needsAttention } from "@/lib/system-health";
import { cn } from "@/lib/utils";

/**
 * Header bell: open alerts nobody has acknowledged yet. Red with a ringing bell
 * when any of them is critical. Opens System health.
 */
const AlertBell = () => {
  const { alerts } = useOpenAlerts(true);
  const waiting = needsAttention(alerts);
  const critical = waiting.some((a) => a.severity === "critical");
  const count = waiting.length;
  const label =
    count === 0
      ? "System health: nothing needs attention"
      : `System health: ${count} alert${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} attention${critical ? ", including critical" : ""}`;
  const Icon = critical ? BellRing : Bell;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={label} asChild>
          <Link to="/admin/system">
            <Icon className={cn("h-5 w-5", critical ? "text-status-alert" : "text-muted-foreground")} />
            {count > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white",
                  critical ? "bg-status-alert" : "bg-warn-ink",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export default AlertBell;
