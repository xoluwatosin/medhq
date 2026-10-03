// A second read of a draft contract.
//
// Before a contract is issued its wording freezes and goes to the candidate,
// so an admin can ask for a review first. The draft is read as saved, the
// wording is sent to the model, and plain-English comments come back: gaps,
// contradictions, and terms worth a second look. The model advises; it never
// edits, and the admin always decides.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const stripHtml = (html: string) =>
  (html || "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "AI is not configured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Not signed in" }, 401);

    const admin = createClient(url, service);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await caller.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: "Not signed in" }, 401);

    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden: admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const contractId = typeof body?.contract_id === "string" ? body.contract_id : "";
    if (!contractId) return json({ error: "contract_id is required" }, 400);

    const { data: contract } = await admin
      .from("mu_contracts")
      .select("id, status, job_title, start_date, end_date, notice_period, pay_amount, pay_currency, pay_frequency, location, is_clinical, fields, clauses, annexes")
      .eq("id", contractId)
      .maybeSingle();
    if (!contract) return json({ error: "Contract not found" }, 404);
    if (contract.status !== "draft") return json({ error: "Only drafts can be reviewed" }, 400);

    const fields = contract.fields || {};
    const fieldLines = Object.entries(fields)
      .filter(([, v]) => String(v || "").trim())
      .map(([k, v]) => `${k}: ${String(v).trim()}`)
      .join("\n");

    const clauseText = (contract.clauses || [])
      .map((c: any, i: number) => `CLAUSE ${i + 1}: ${c.heading || "(no heading)"}\n${stripHtml(c.body || "")}`)
      .join("\n\n");

    const annexText = (contract.annexes || [])
      .filter((a: any) => a.include !== false)
      .map((a: any) => {
        const bits = [`${a.code}: ${a.title}`];
        if (a.requires_signature) bits.push("(requires signature)");
        if (a.clinical_only) bits.push("(clinical roles only)");
        const text = stripHtml(a.body || "");
        return `${bits.join(" ")}\n${text || "(no wording, attachment only)"}`;
      })
      .join("\n\n");

    const prompt = `You are reviewing a draft employment contract pack for Medic Connect Limited, a healthcare staffing and care organisation operating in Nigeria and the UK. You are a careful second reader, not a lawyer and not an editor.

Read the draft below and report, in plain British English:
1. Anything missing that a contract of this kind would normally carry.
2. Contradictions or tensions between clauses, annexes, or the stated terms (dates, salary, notice, hours, location).
3. Wording that is ambiguous, reads oddly, or could embarrass the company in front of the candidate.
4. Anything that looks like a leftover placeholder, template note, or drafting artefact.

Be specific: quote the clause or annex and the exact wording you mean. Do not invent legal citations. If the draft is sound, say so plainly rather than manufacturing concerns. Keep it under 400 words, as a short numbered list.

STATED TERMS
Job title: ${contract.job_title || fields.job_title || "(not set)"}
Start date: ${contract.start_date || "(not set)"}
End date: ${contract.end_date || "(none, permanent)"}
Notice period: ${contract.notice_period || fields.notice_period || "(not set)"}
Pay: ${contract.pay_amount ? `${contract.pay_currency || "NGN"} ${contract.pay_amount} ${contract.pay_frequency || ""}` : fields.salary_figure || "(not set)"}
Location: ${contract.location || fields.primary_place_of_work || "(not set)"}
Clinical role: ${contract.is_clinical ? "yes" : "no"}

DETAIL FIELDS
${fieldLines || "(none filled)"}

OFFER LETTER CLAUSES
${clauseText || "(no clauses)"}

ANNEXES IN THE PACK
${annexText || "(no annexes)"}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: `The reviewer is unavailable (${res.status}): ${text.slice(0, 200)}` }, 502);
    }

    const data = await res.json();
    const review = (data?.content || [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();

    await admin.from("mu_contract_events").insert({
      contract_id: contractId,
      event_type: "reviewed",
      actor_name: userData.user.email || "Admin",
      actor_role: "admin",
      detail: "Draft wording reviewed before issue",
    });

    return json({ review });
  } catch (err: any) {
    return json({ error: err?.message || "Something went wrong" }, 500);
  }
});
