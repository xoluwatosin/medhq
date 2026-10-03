// Turn an opportunity brief into structured requirements.
//
// The function only ever returns a PROPOSAL. Nothing is written to the
// opportunity: an admin reviews and edits every requirement in the UI before it
// is saved. The model maps free text onto the controlled vocabulary; it never
// selects or ranks a candidate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROFESSIONS } from "../_shared/professions.ts";
import { FACET_TYPES, sanitiseFacets, vocabularyPrompt } from "../_shared/match-taxonomy.ts";

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

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    professions: { type: "array", items: { type: "string", enum: [...PROFESSIONS] } },
    min_years: { type: ["number", "null"] },
    states: { type: "array", items: { type: "string" } },
    lgas: { type: "array", items: { type: "string" } },
    requires_licence: { type: "boolean" },
    requires_right_to_work: { type: "boolean" },
    facets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          facet_type: { type: "string", enum: [...FACET_TYPES] },
          code: { type: "string" },
          requirement: { type: "string", enum: ["required", "desirable"] },
          evidence: { type: ["string", "null"] },
        },
        required: ["facet_type", "code", "requirement", "evidence"],
      },
    },
    notes: { type: ["string", "null"] },
  },
  required: ["professions", "min_years", "states", "lgas", "requires_licence", "requires_right_to_work", "facets", "notes"],
} as const;

const SYSTEM = `You read healthcare role briefs in Nigeria and convert them into structured requirements.
Rules:
- Report only what the brief states or plainly implies. Never invent a requirement.
- Default every facet to "desirable". Mark a facet "required" ONLY where the brief uses explicit mandatory language about that specific item: "must", "must have", "required", "mandatory", "essential", "minimum", "cannot be considered without", or an equivalent. Words like "ideally", "preferred", "an advantage", "desirable", "we are looking for", "experience in", "familiarity with", "strong", "good", "knowledge of" and any bare bulleted list are DESIRABLE, not required.
- A brief that reads as a wish list should produce zero or very few required facets. Over-marking as required silently empties the shortlist, which is worse than a longer ranked list.
- Only return facet codes from the controlled vocabulary, spelled exactly as written.
- min_years: a whole number only when the brief states a minimum. Otherwise null.
- states and lgas: Nigerian state or local government names exactly as written in the brief. Empty arrays when the brief gives no location constraint.
- requires_licence: true only when a professional licence or registration is stated as necessary.
- notes: one short sentence naming anything important that does not fit the structure, else null.
Controlled vocabulary:
${vocabularyPrompt()}
Profession categories: ${PROFESSIONS.join(", ")}.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callClaude(brief: string) {
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
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: `Convert this brief into structured requirements.\n\n${brief}` }],
      tools: [{ name: "role_requirements", description: "Record the structured requirements.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "role_requirements" },
    }),
  });
  if (!res.ok) return { error: `Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = await res.json();
  const block = (body?.content || []).find((b: any) => b?.type === "tool_use");
  if (!block?.input) return { error: "Claude returned no structured output" };
  return { data: block.input as any, model: CLAUDE_MODEL };
}

async function callGateway(brief: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: FALLBACK_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Convert this brief into structured requirements.\n\n${brief}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "role_requirements", strict: true, schema: SCHEMA } },
    }),
  });
  if (res.status === 429) return { error: "Rate limited by the AI gateway, try again shortly" };
  if (res.status === 402) return { error: "AI credits exhausted" };
  if (!res.ok) return { error: `AI gateway error ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = await res.json();
  try {
    return { data: JSON.parse(body?.choices?.[0]?.message?.content ?? ""), model: FALLBACK_MODEL };
  } catch {
    return { error: "The model returned malformed JSON" };
  }
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
    if (!/^[0-9a-f-]{36}$/i.test(opportunityId)) return json({ error: "Provide opportunity_id" }, 400);

    const { data: opp } = await admin
      .from("matchmaker_opportunities")
      .select("id, title, summary, description, location, role_details, requirements, brief, client_notes")
      .eq("id", opportunityId)
      .maybeSingle();
    if (!opp) return json({ error: "Opportunity not found" }, 404);

    const brief = [
      `Title: ${opp.title}`,
      opp.location ? `Location: ${opp.location}` : "",
      opp.summary ? `Summary: ${opp.summary}` : "",
      opp.role_details ? `Role details: ${opp.role_details}` : "",
      opp.requirements ? `Requirements: ${opp.requirements}` : "",
      opp.description ? `Description: ${opp.description}` : "",
      // Client requests carry their whole story in the brief, not the job fields.
      opp.brief ? `Client brief: ${opp.brief}` : "",
      opp.client_notes ? `Client notes: ${opp.client_notes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 40_000);

    if (brief.trim().length < 40) return json({ error: "The brief is too short to extract requirements from" }, 400);

    let result = await callClaude(brief);
    if ((result as any).error) {
      console.log("Claude unavailable for opportunity parse:", (result as any).error);
      result = await callGateway(brief);
    }
    if ((result as any).error) return json({ error: (result as any).error }, 502);

    const raw = (result as any).data ?? {};
    const facets = sanitiseFacets(raw.facets).map((f) => {
      const src = (Array.isArray(raw.facets) ? raw.facets : []).find(
        (r: any) => r?.facet_type === f.facet_type && String(r?.code || "").toLowerCase() === f.code,
      );
      return {
        facet_type: f.facet_type,
        code: f.code,
        requirement: src?.requirement === "required" ? "required" : "desirable",
        evidence: src?.evidence ? String(src.evidence).slice(0, 400) : null,
      };
    });

    return json({
      model: (result as any).model,
      proposal: {
        professions: (Array.isArray(raw.professions) ? raw.professions : []).filter((p: string) =>
          (PROFESSIONS as readonly string[]).includes(p),
        ),
        min_years: Number.isFinite(Number(raw.min_years)) && raw.min_years !== null ? Math.max(0, Math.round(Number(raw.min_years))) : null,
        states: (Array.isArray(raw.states) ? raw.states : []).map((s: string) => String(s).trim()).filter(Boolean).slice(0, 10),
        lgas: (Array.isArray(raw.lgas) ? raw.lgas : []).map((s: string) => String(s).trim()).filter(Boolean).slice(0, 20),
        requires_licence: Boolean(raw.requires_licence),
        requires_right_to_work: Boolean(raw.requires_right_to_work),
        facets,
        notes: raw.notes ? String(raw.notes).slice(0, 400) : null,
      },
    });
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 300) }, 500);
  }
});
