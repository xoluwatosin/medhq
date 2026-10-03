// Explain a match that the database already made.
//
// The ranking is done in SQL (mu_match_candidates). This function only turns an
// existing score breakdown plus the candidate's own evidence into a short,
// readable explanation. It never changes an order and never adds a candidate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const CLAUDE_MODEL = "claude-sonnet-4-5";
const FALLBACK_MODEL = "google/gemini-3.6-flash";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const SYSTEM = `You write short hiring notes for a Nigerian healthcare talent team.
You are given a role, a candidate summary, and a scoring breakdown that has already been calculated.
Rules:
- Explain the fit in 2 to 4 sentences of plain British English. No bullet points, no headings.
- Use only the facts supplied. Never invent experience, employers, or credentials.
- Say plainly what is missing or unproven as well as what fits.
- Treat parsed CV data as unverified: use wording like "their CV states" rather than asserting it as fact.
- Never say the candidate should be hired or ranked first. Describe the fit, nothing more.
- No em dashes.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callClaude(prompt: string) {
  if (!ANTHROPIC_API_KEY) return { error: "No Anthropic key configured" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return { error: `Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = await res.json();
  const text = (body?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim();
  return text ? { text, model: CLAUDE_MODEL } : { error: "Claude returned no text" };
}

async function callGateway(prompt: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: FALLBACK_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (res.status === 429) return { error: "Rate limited by the AI gateway, try again shortly" };
  if (res.status === 402) return { error: "AI credits exhausted" };
  if (!res.ok) return { error: `AI gateway error ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = await res.json();
  const text = String(body?.choices?.[0]?.message?.content ?? "").trim();
  return text ? { text, model: FALLBACK_MODEL } : { error: "The model returned no text" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorised" }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await caller.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorised" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: any) => r.role === "admin")) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const opportunityId = String(body.opportunity_id ?? "");
    const personId = String(body.person_id ?? "");
    const refresh = Boolean(body.refresh);
    if (!/^[0-9a-f-]{36}$/i.test(opportunityId) || !/^[0-9a-f-]{36}$/i.test(personId)) {
      return json({ error: "Provide opportunity_id and person_id" }, 400);
    }

    if (!refresh) {
      const { data: cached } = await admin
        .from("mu_match_rationales")
        .select("rationale, model, created_at")
        .eq("opportunity_id", opportunityId)
        .eq("person_id", personId)
        .maybeSingle();
      if (cached) return json({ rationale: cached.rationale, model: cached.model, cached: true });
    }

    const [{ data: opp }, { data: person }, { data: facets }, { data: parsed }, { data: docs }] = await Promise.all([
      admin
        .from("matchmaker_opportunities")
        .select("title, location, summary, role_details, requirements, match_min_years, match_professions, match_states, match_lgas")
        .eq("id", opportunityId)
        .maybeSingle(),
      admin
        .from("mu_people")
        .select("full_name, profession, years_experience, state, lga, licensing_body, license_expiry, availability, languages")
        .eq("id", personId)
        .maybeSingle(),
      admin.from("mu_profile_facets").select("facet_type, code, source, evidence").eq("person_id", personId),
      admin.from("mu_parsed_fields").select("field, value, status").eq("person_id", personId).limit(40),
      admin.from("mu_documents").select("label, verified").eq("person_id", personId),
    ]);

    if (!opp || !person) return json({ error: "Opportunity or person not found" }, 404);

    const breakdown = body.breakdown && typeof body.breakdown === "object" ? body.breakdown : {};

    const prompt = [
      `ROLE\n${JSON.stringify(opp)}`,
      `CANDIDATE\n${JSON.stringify(person)}`,
      `NORMALISED FACETS (source tells you how trustworthy each is)\n${JSON.stringify(facets || [])}`,
      `UNVERIFIED CV CLAIMS\n${JSON.stringify(parsed || [])}`,
      `DOCUMENTS ON FILE\n${JSON.stringify(docs || [])}`,
      `SCORE BREAKDOWN ALREADY CALCULATED\n${JSON.stringify(breakdown)}`,
      `Write the fit note.`,
    ].join("\n\n");

    let result = await callClaude(prompt);
    if ((result as any).error) {
      console.log("Claude unavailable for rationale:", (result as any).error);
      result = await callGateway(prompt);
    }
    if ((result as any).error) return json({ error: (result as any).error }, 502);

    const rationale = (result as any).text as string;
    await admin.from("mu_match_rationales").upsert(
      {
        opportunity_id: opportunityId,
        person_id: personId,
        model: (result as any).model,
        rationale,
        breakdown,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "opportunity_id,person_id" },
    );

    return json({ rationale, model: (result as any).model, cached: false });
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 300) }, 500);
  }
});
