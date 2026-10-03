// One way for Care to send anything.
//
// Every send is a durable record first. The record is claimed against a
// dedupe key, so a retried request, a replayed event or a double click all
// resolve to the same notification rather than a second message. An attempt
// is written before the provider is called and the outcome only after it
// answers, so nothing is ever marked sent because sending began.
//
// This is delivery. It holds no lifecycle decision and moves no stage.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { kitEmailFromMarkdown } from "./kit-email.ts";
import { emailTags } from "./email-tags.ts";

export type NotificationKind = "pre_assessment_link" | "portal_invitation" | "account_setup";
export type NotificationChannel = "email" | "whatsapp" | "manual";

export interface EmailBody {
  eyebrow: string;
  title: string;
  standfirst: string;
  markdown: string;
  footnote?: string;
}

export interface NotificationRequest {
  kind: NotificationKind;
  channel: NotificationChannel;
  /** The one key that makes this send the same send on every replay. */
  dedupeKey: string;
  destination?: string | null;
  personId?: string | null;
  clientId?: string | null;
  contactId?: string | null;
  relatedTable?: string | null;
  relatedId?: string | null;
  subject?: string | null;
  origin?: string;
  /** Absent for a channel that only needs a record, such as a copied link. */
  email?: EmailBody | null;
  /**
   * An explicit staff "Send again". The same durable record is used, a new
   * attempt is made and the provider is called again, even if an earlier
   * attempt succeeded — because the link it carried may since have changed.
   * An accidental replay leaves this unset and nothing goes out twice.
   */
  resend?: boolean;
}

export interface NotificationResult {
  notification_id: string;
  status: "queued" | "sending" | "sent" | "failed" | "cancelled";
  created: boolean;
  attempts: number;
  error: string | null;
}

const RESEND_URL = "https://api.resend.com/emails";

export async function dispatchNotification(
  db: SupabaseClient,
  request: NotificationRequest,
): Promise<NotificationResult> {
  const { data: claimed, error: claimError } = await db.rpc("care_notification_claim", {
    _kind: request.kind,
    _channel: request.channel,
    _dedupe_key: request.dedupeKey,
    _destination: request.destination ?? null,
    _person_id: request.personId ?? null,
    _client_id: request.clientId ?? null,
    _contact_id: request.contactId ?? null,
    _related_table: request.relatedTable ?? null,
    _related_id: request.relatedId ?? null,
    _subject: request.subject ?? null,
    _origin: request.origin ?? "system",
  });
  if (claimError) throw claimError;

  const row = (Array.isArray(claimed) ? claimed[0] : claimed) as
    { id: string; status: NotificationResult["status"]; attempt_count: number; created: boolean };

  const done: NotificationResult = {
    notification_id: row.id,
    status: row.status,
    created: row.created,
    attempts: row.attempt_count,
    error: null,
  };

  // Deliberately stopped. Nothing is sent, ever.
  if (row.status === "cancelled") return done;
  // An accidental replay of the same logical send keeps the earlier outcome.
  if (!request.resend && (row.status === "sent" || !row.created)) return done;

  // A record with no message to send stays queued and visible.
  if (request.channel !== "email" || !request.email) return done;

  const address = (request.destination ?? "").trim().toLowerCase();
  if (!address) {
    await db.rpc("care_notification_result", {
      _id: row.id, _ok: false, _provider_message_id: null,
      _provider_error: "There is no email address for this person",
    });
    return { ...done, status: "failed", error: "There is no email address for this person" };
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    await db.rpc("care_notification_result", {
      _id: row.id, _ok: false, _provider_message_id: null,
      _provider_error: "Email is not configured",
    });
    return { ...done, status: "failed", error: "Email is not configured" };
  }

  // The attempt is owned before the provider is called. A second request for
  // the same send is refused here, so only one email leaves.
  let attempts = row.attempt_count;
  const { data: attemptNo, error: attemptError } = await db.rpc("care_notification_attempt", {
    _id: row.id,
    _force: request.resend === true,
  });
  if (attemptError) {
    return { ...done, status: row.status, error: attemptError.message };
  }
  attempts = Number(attemptNo ?? attempts + 1);

  const subject = request.subject ?? request.email.title;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medic Connect <hello@medicconnect.co>",
        to: [address],
        reply_to: "hello@medicconnect.co",
        subject,
        html: kitEmailFromMarkdown({
          eyebrow: request.email.eyebrow,
          title: request.email.title,
          standfirst: request.email.standfirst,
          preheader: subject,
          markdown: request.email.markdown,
          footnote: request.email.footnote ??
            "Your details are held as part of the care record and are not shared for any other purpose.",
        }),
        tags: emailTags(request.kind.replace(/_/g, "-"), request.clientId ?? null),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("care notification provider refused", request.kind, res.status, detail);
      await db.rpc("care_notification_result", {
        _id: row.id, _ok: false, _provider_message_id: null,
        _provider_error: `The email could not be sent (${res.status})`,
      });
      return { ...done, status: "failed", attempts, error: "The email could not be sent" };
    }

    const payload = await res.json().catch(() => ({}));
    await db.rpc("care_notification_result", {
      _id: row.id, _ok: true,
      _provider_message_id: typeof payload?.id === "string" ? payload.id : null,
      _provider_error: null,
    });
    return { ...done, status: "sent", attempts, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "The email could not be sent";
    console.error("care notification failed", request.kind, message);
    await db.rpc("care_notification_result", {
      _id: row.id, _ok: false, _provider_message_id: null, _provider_error: message,
    });
    return { ...done, status: "failed", attempts, error: "The email could not be sent" };
  }
}
