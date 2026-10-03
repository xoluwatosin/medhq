// Sends the queued follow-up nudge to candidates who were invited but have not yet entered the portal.
// Called from the admin Intelligence dashboard or, in future, by a scheduled sweep.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitMarkdown } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-run-key, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const sentKey = req.headers.get("x-run-key");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = bearer === serviceKey;
  if (!allowed && sentKey) {
    const { data: keyOk } = await admin.rpc("job_key_check", {
      p_name: "followup_run_key",
      p_value: sentKey,
    });
    allowed = keyOk === true;
  }
  if (!allowed && bearer) {
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (user) {
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      allowed = Boolean(role);
    }
  }
  if (!allowed) return json({ error: "Not permitted." }, 401);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "Email is not configured." }, 500);

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const all = Boolean(body?.all);
  const dryRun = Boolean(body?.dry_run);

  let query = admin
    .from("followup_queue")
    .select("id, person_id, email, reason, mu_people(id, full_name)")
    .eq("status", "pending");
  if (ids.length) query = query.in("id", ids);
  const { data: rows, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ sent: 0, skipped: 0 });

  const { data: suppressed } = await admin.from("email_suppressions").select("email");
  const blocked = new Set((suppressed ?? []).map((s: any) => String(s.email).toLowerCase()));
  const placeholder = /@(example|test|localhost|invalid)\.(com|org|net|test|local)$/i;

  const results: { email: string; ok: boolean; detail?: string }[] = [];
  const sentIds: string[] = [];

  const GAP_LABELS: Record<string, string> = {
    profession: "your profession",
    state: "the state you live in",
    lga: "your local government area",
    licensing_body: "your licensing body",
    license_number: "your licence number",
    license_expiry: "your licence expiry date",
    languages: "the languages you speak",
    right_to_work: "your right to work details",
    nysc_status: "your NYSC status",
    institution: "the institution you trained at",
    course_of_study: "your course of study",
    expected_graduation: "your expected graduation date",
    joining_statement: "your short joining statement",
    sex: "your basic personal details",
    availability: "the days you are available",
    work_preferences: "your work preferences",
    references: "your references",
  };
  const labelFor = (k: string) => GAP_LABELS[k] ?? k.replace(/_/g, " ");

  for (const row of rows) {
    const person = ((row as any).mu_people ?? null) as { id: string; full_name: string | null } | null;
    const to = (row.email ?? "").trim().toLowerCase();
    if (!to) { results.push({ email: String(row.id), ok: false, detail: "missing data" }); continue; }
    if (blocked.has(to) || placeholder.test(to)) {
      results.push({ email: to, ok: false, detail: "suppressed or placeholder address" });
      await admin.from("followup_queue").update({ status: "skipped" }).eq("id", row.id);
      continue;
    }

    const firstName = (person?.full_name ?? "").split(" ")[0];
    let isNoAccount = row.reason === "invited_no_account";

    // Last-second reality check so nobody is nudged for something they have already done.
    if (isNoAccount && person?.id) {
      const { data: linked } = await admin
        .from("mu_people").select("auth_user_id").eq("id", person.id).maybeSingle();
      if (linked?.auth_user_id) isNoAccount = false;
    }

    let gaps: string[] = [];
    if (!isNoAccount && person?.id) {
      const { data: g } = await admin.rpc("mu_person_gaps", { _person: person.id });
      gaps = Array.isArray(g) ? (g as string[]) : [];
      if (!gaps.length) {
        results.push({ email: to, ok: false, detail: "profile already complete" });
        await admin.from("followup_queue").update({ status: "resolved" }).eq("id", row.id);
        continue;
      }
    }

    const gapList = gaps.slice(0, 6).map((k) => `- ${labelFor(k)}`).join("\n");

    const md = isNoAccount
      ? [
          `We emailed you an invitation to join the Medic Connect candidate portal a couple of days ago, but we have not seen you sign in yet.`,
          ``,
          `If you have been busy, that is completely understandable. The link below will take you straight to the start page.`,
          ``,
          `[[cta:Open your candidate portal|${SITE_URL}/portal/start]]`,
          ``,
          `If you did not receive the first email, please check your spam or junk folder, or reply to this message and we will resend it.`,
        ].join("\n")
      : [
          `Thank you for setting up your Medic Connect candidate profile. There ${gaps.length === 1 ? "is one thing" : `are ${gaps.length} things`} still outstanding before we can put you forward for roles.`,
          ``,
          `Still to add:`,
          ``,
          gapList,
          ``,
          `[[cta:Finish these in your profile|${SITE_URL}/portal/login]]`,
          ``,
          `If you are stuck on any of them, reply to this email and we will sort it out for you.`,
        ].join("\n");

    const html = kitEmail({
      eyebrow: "Candidate portal",
      title: isNoAccount
        ? (firstName ? `${firstName}, your invitation is still open` : "Your invitation is still open")
        : (firstName ? `${firstName}, a few things left on your profile` : "A few things left on your profile"),
      standfirst: "This is a friendly follow-up from the Medic Connect talent team.",
      preheader: isNoAccount
        ? "Your Medic Connect candidate invitation is still waiting."
        : "A short list of what is still outstanding on your profile.",
      bodyHtml: kitMarkdown(md),
      footnote:
        "You are receiving this because you were invited to join the Medic Connect candidate portal. Never share your password or confirmation code with anyone.",
    });

    if (dryRun) { results.push({ email: to, ok: true, detail: isNoAccount ? "dry run" : `dry run: ${gaps.join(", ")}` }); continue; }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Medic Connect <noreply@medicconnect.co>",
        to: [to],
        subject: isNoAccount
          ? "Your Medic Connect candidate invitation is waiting"
          : gaps.length === 1
            ? `One thing left on your Medic Connect profile: ${labelFor(gaps[0])}`
            : "A few things left on your Medic Connect profile",
        tags: [...emailTags("followup-nudge", person?.id ?? "unlinked"), { name: "type", value: row.reason }],
        html,
      }),
    });

    const ok = res.ok;
    const detail = ok ? undefined : await res.text();
    if (!ok) console.error("followup nudge send failed", to, res.status, detail);
    results.push({ email: to, ok, detail });

    if (ok) {
      sentIds.push(row.id);
      if (person?.id) {
        await admin.from("mu_activity").insert({
          person_id: person.id,
          actor_name: "System",
          action: "email_sent",
          detail: { type: "followup_nudge", email: to, reason: row.reason },
        });
      }
    }

  }

  if (sentIds.length && !dryRun) {
    await admin
      .from("followup_queue")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  return json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
});
