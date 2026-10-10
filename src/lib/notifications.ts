// Notifications to people: written by the database when something needs you
// or changes for you, read here for the bell in the admin header.
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export interface StaffNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export const loadNotifications = async (limit = 30): Promise<StaffNotification[]> => {
  const { data, error } = await db().from("staff_notifications")
    .select("id, kind, title, body, link, created_at, read_at")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as StaffNotification[];
};

/** Marks the given notifications read, or all of them. */
export const markNotificationsRead = async (ids?: string[]): Promise<void> => {
  await db().rpc("staff_notifications_read", { _ids: ids ?? null });
};

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "12 Oct". */
export const timeAgo = (iso: string, now = Date.now()): string => {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
