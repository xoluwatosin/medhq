// Email analytics — one event stream (campaign_events) covers campaigns and
// every tagged transactional send. All reads dedupe to unique recipients.
import { adminDb } from "@/lib/admin-utils";
import { selectAll } from "@/lib/select-all";

export interface EmailEvent {
  id: string;
  campaign_id: string | null;
  template: string | null;
  person_id: string | null;
  event_type: string;
  recipient_email: string;
  link_url: string | null;
  created_at: string;
}

export interface LinkStat {
  url: string;
  uniqueClickers: number;
  clicks: number;
}

export interface CampaignFunnel {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  claimed: number;
}

const uniq = (rows: { recipient_email: string }[]) =>
  new Set(rows.map((r) => r.recipient_email.toLowerCase())).size;

/** Per-link click breakdown for one campaign. */
export async function campaignLinkStats(campaignId: string): Promise<LinkStat[]> {
  const data = await selectAll<{ link_url: string | null; recipient_email: string }>((a, z) =>
    adminDb().from("campaign_events").select("id, link_url, recipient_email")
      .eq("campaign_id", campaignId).eq("event_type", "clicked").order("id").range(a, z)).catch(() => null);
  if (!data) return [];
  const byUrl = new Map<string, { clicks: number; people: Set<string> }>();
  for (const r of data as { link_url: string | null; recipient_email: string }[]) {
    const url = r.link_url || "(unknown link)";
    const entry = byUrl.get(url) || { clicks: 0, people: new Set<string>() };
    entry.clicks += 1;
    entry.people.add(r.recipient_email.toLowerCase());
    byUrl.set(url, entry);
  }
  return [...byUrl.entries()]
    .map(([url, v]) => ({ url, uniqueClickers: v.people.size, clicks: v.clicks }))
    .sort((a, b) => b.uniqueClickers - a.uniqueClickers);
}

/** Sent → delivered → opened → clicked → claimed funnel for one campaign. */
export async function campaignFunnel(campaignId: string): Promise<CampaignFunnel> {
  // Every event: a campaign to the whole audience passes 1,000 rows.
  const data = await selectAll<{ event_type: string; recipient_email: string }>((a, z) =>
    adminDb().from("campaign_events").select("id, event_type, recipient_email")
      .eq("campaign_id", campaignId).order("id").range(a, z)).catch(() => null);
  if (!data) return { sent: 0, delivered: 0, opened: 0, clicked: 0, claimed: 0 };
  const rows = data as { event_type: string; recipient_email: string }[];
  const funnel: CampaignFunnel = {
    sent: uniq(rows.filter((r) => r.event_type === "sent")),
    delivered: uniq(rows.filter((r) => r.event_type === "delivered")),
    opened: uniq(rows.filter((r) => r.event_type === "opened")),
    clicked: uniq(rows.filter((r) => r.event_type === "clicked")),
    claimed: 0,
  };
  const emails = [...new Set(rows.map((r) => r.recipient_email.toLowerCase()))];
  if (emails.length > 0) {
    const claimed = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const { data: inv } = await adminDb()
        .from("claim_invites")
        .select("email")
        .in("email", emails.slice(i, i + 200))
        .not("claimed_at", "is", null);
      for (const r of inv || []) claimed.add(String((r as any).email).toLowerCase());
    }
    funnel.claimed = claimed.size;
  }
  return funnel;
}

/** Full email history for one person, across campaigns and transactional sends. */
export async function emailHistoryFor(email: string): Promise<EmailEvent[]> {
  const { data, error } = await adminDb()
    .from("campaign_events")
    .select("id, campaign_id, template, person_id, event_type, recipient_email, link_url, created_at")
    .eq("recipient_email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as EmailEvent[];
}

/** Distinct templates seen, for filters. */
export async function emailTemplatesSeen(): Promise<string[]> {
  const data = await selectAll<{ template: string }>((a, z) =>
    adminDb().from("campaign_events").select("id, template").not("template", "is", null).order("id").range(a, z)).catch(() => []);
  return [...new Set(data.map((r) => r.template))].sort();
}
