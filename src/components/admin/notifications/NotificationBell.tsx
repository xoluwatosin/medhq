import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { loadNotifications, markNotificationsRead, timeAgo, type StaffNotification } from "@/lib/notifications";

const POLL_MS = 60_000;

/** The bell in the admin header: what needs you, newest first. */
export const NotificationBell = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await loadNotifications()); } catch { /* keep what we have */ }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const unread = items.filter((n) => !n.read_at);

  const openItem = async (n: StaffNotification) => {
    setOpen(false);
    if (!n.read_at) {
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)));
      void markNotificationsRead([n.id]);
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((p) => (p.read_at ? p : { ...p, read_at: now })));
    await markNotificationsRead();
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center border border-navy bg-white px-1 text-[10px] font-extrabold leading-none text-navy">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-32px))] p-0">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <p className="text-[15px] font-extrabold tracking-[-0.02em] text-navy">Notifications</p>
          {unread.length > 0 && (
            <button type="button" onClick={() => void readAll()} className="text-[13px] font-bold text-brand hover:underline">
              Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-[14px] text-muted-foreground">Nothing yet. You will hear here when something needs you.</p>
        ) : (
          <ul className="max-h-[min(70vh,480px)] divide-y divide-line-soft overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void openItem(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-tint/50 ${n.read_at ? "" : "bg-tint/30"}`}
                >
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 ${n.read_at ? "bg-transparent" : "bg-brand"}`} />
                  <span className="min-w-0">
                    <span className={`block text-[14px] leading-snug ${n.read_at ? "font-semibold text-ink" : "font-extrabold text-navy"}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground line-clamp-2">{n.body}</span>}
                    <span className="mt-1 block text-[12px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
