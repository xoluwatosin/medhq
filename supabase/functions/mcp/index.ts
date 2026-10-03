// supabase function: mcp
// Originally bundled from src/lib/mcp by the Lovable Vite plugin. That source
// tree is gone; this file is now the source. Edit it directly.
// src/lib/mcp/index.ts
import { auth, defineMcp } from "npm:@lovable.dev/mcp-js@0.22.2";

// src/lib/mcp/tools/list_blog_posts.ts
import { defineTool } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z } from "npm:zod@^3.25.0";

// src/lib/mcp/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@^2.93.2";
function runtimeEnv(name) {
  const runtime = globalThis;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}
function configuredEnv(names) {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return void 0;
}
function supabaseProjectUrl() {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}
function supabasePublishableKey() {
  const direct = configuredEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  ]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed;
        const key = [keys.default, ...Object.values(keys)].find(
          (value) => typeof value === "string" && value.trim().startsWith("sb_publishable_")
        )?.trim();
        if (key) return key;
      }
    } catch {
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error(
    "SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required"
  );
}
function supabaseForUser(ctx) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// src/lib/mcp/result.ts
function fail(message, detail) {
  const text = detail ? `${message}: ${safe(detail)}` : message;
  return { content: [{ type: "text", text }], isError: true, structuredContent: { error: text } };
}
function ok(payload, text) {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(payload, null, 2) }],
    structuredContent: payload
  };
}
function safe(value) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
async function guard(toolName, run) {
  try {
    return await run();
  } catch (err) {
    return fail(`${toolName} failed`, err);
  }
}

// src/lib/mcp/tools/list_blog_posts.ts
var list_blog_posts_default = defineTool({
  name: "list_blog_posts",
  title: "List blog posts",
  description: "List Medic Connect blog posts visible to the signed-in user (respects RLS). Note: status, approval_status and published_at are independent fields and can drift.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
    status: z.string().trim().min(1).max(40).optional().describe("Filter by post status (draft, published, scheduled).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => guard("list_blog_posts", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    let q = supabaseForUser(ctx).from("blog_posts").select("id,title,slug,category,author,status,approval_status,archived,published_at,created_at").order("created_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail("Database error", error.message);
    return ok({ posts: data ?? [] });
  })
});

// src/lib/mcp/tools/create_blog_draft.ts
import { defineTool as defineTool2 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z2 } from "npm:zod@^3.25.0";
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
var create_blog_draft_default = defineTool2({
  name: "create_blog_draft",
  title: "Create blog draft",
  description: "Create a new draft blog post for Medic Connect as the signed-in admin. Always saved as draft with approval_status 'pending'; a super-admin still publishes it.",
  inputSchema: {
    title: z2.string().trim().min(3).max(200).describe("Post title."),
    content: z2.string().min(1).describe("HTML or Markdown body of the post."),
    excerpt: z2.string().trim().min(1).max(500).describe("Short excerpt shown in listings (required)."),
    category: z2.string().trim().min(1).max(80).optional().describe("Category label (default 'General')."),
    author: z2.string().trim().min(1).max(120).optional().describe("Author byline (default 'Medic Connect')."),
    slug: z2.string().trim().min(3).max(120).optional().describe("URL slug; auto-generated from title if omitted.")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, excerpt, category, author, slug }, ctx) => guard("create_blog_draft", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const finalSlug = slug ? slugify(slug) : `${slugify(title)}-${Date.now().toString(36)}`;
    const { data, error } = await supabaseForUser(ctx).from("blog_posts").insert({
      title,
      slug: finalSlug,
      content,
      excerpt,
      category: category ?? "General",
      author: author ?? "Medic Connect",
      status: "draft",
      published_at: null,
      approval_status: "pending",
      created_by: ctx.getUserId(),
      created_by_name: ctx.getUserEmail() ?? null
    }).select("id,title,slug,status,approval_status,created_at").single();
    if (error) return fail("Database error", error.message);
    return ok({ post: data }, `Created draft "${data.title}" (id: ${data.id}, slug: ${data.slug}).`);
  })
});

// src/lib/mcp/tools/list_campaigns.ts
import { defineTool as defineTool3 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z3 } from "npm:zod@^3.25.0";
var list_campaigns_default = defineTool3({
  name: "list_campaigns",
  title: "List campaigns",
  description: "List email campaigns visible to the signed-in admin (respects RLS). Returns title, subject, status, approval status, schedule and send stats.",
  inputSchema: {
    limit: z3.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
    status: z3.string().trim().min(1).max(40).optional().describe("Filter by campaign status."),
    include_archived: z3.boolean().optional().describe("Include archived campaigns (default false).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, include_archived }, ctx) => guard("list_campaigns", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    let q = supabaseForUser(ctx).from("campaigns").select(
      "id,title,subject,status,approval_status,audience_type,scheduled_for,sent_at,total_recipients,total_delivered,total_opened,total_clicked,created_at"
    ).order("created_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    if (!include_archived) q = q.eq("archived", false);
    const { data, error } = await q;
    if (error) return fail("Database error", error.message);
    return ok({ campaigns: data ?? [] });
  })
});

// src/lib/mcp/tools/list_enquiries.ts
import { defineTool as defineTool4 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z4 } from "npm:zod@^3.25.0";
var list_enquiries_default = defineTool4({
  name: "list_enquiries",
  title: "List contact enquiries",
  description: "List recent contact form submissions from the Medic Connect website. Admin-only via RLS. Returns name, email, phone, service, message, status and attribution.",
  inputSchema: {
    limit: z4.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
    status: z4.string().trim().min(1).max(40).optional().describe("Filter by enquiry status."),
    include_archived: z4.boolean().optional().describe("Include archived enquiries (default false).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, include_archived }, ctx) => guard("list_enquiries", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    let q = supabaseForUser(ctx).from("contact_submissions").select("id,name,email,phone,service,message,status,archived,utm_source,utm_campaign,created_at").order("created_at", { ascending: false }).limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    if (!include_archived) q = q.eq("archived", false);
    const { data, error } = await q;
    if (error) return fail("Database error", error.message);
    return ok({ enquiries: data ?? [] });
  })
});

// src/lib/mcp/tools/search_heroes.ts
import { defineTool as defineTool5 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z5 } from "npm:zod@^3.25.0";
var ROLE_FAMILIES = [
  {
    test: /nurse|nursing|rn\b|nmcn|bnsc|sister|matron/i,
    professions: ["Registered Nurse", "Nurse/Midwife", "Midwife", "Nursing Assistant"]
  },
  { test: /midwif|\brm\b/i, professions: ["Midwife", "Nurse/Midwife"] },
  { test: /carer|care\s?giver|care assistant|support worker|aide/i, professions: ["Care Assistant", "Home Health Aide"] },
  { test: /doctor|physician|mbbs|medical officer|surgeon/i, professions: ["Medical Doctor"] },
  { test: /pharmac/i, professions: ["Pharmacist", "Pharmacy Technician"] },
  { test: /physio/i, professions: ["Physiotherapist"] },
  { test: /lab|phlebotom/i, professions: ["Medical Laboratory Scientist"] },
  { test: /radiograph|sonograph/i, professions: ["Radiographer"] },
  { test: /paramedic|\bemt\b|ambulance/i, professions: ["Paramedic / Emergency Medical Technician"] },
  { test: /chew|community health/i, professions: ["Community Health Extension Worker"] },
  { test: /research|trial|\bcra\b/i, professions: ["Clinical Research Associate"] },
  { test: /nutrition|dietit/i, professions: ["Nutritionist / Dietitian"] },
  { test: /psycholog|counsel/i, professions: ["Psychologist / Counsellor"] }
];
var expandRole = (role) => ROLE_FAMILIES.filter((f) => f.test.test(role)).flatMap((f) => f.professions);
var search_heroes_default = defineTool5({
  name: "search_heroes",
  title: "Search talent pool",
  description: "Search the Match Universe talent pool (Heroes) by name, email, profession, state, LGA, verification state or minimum years. A role term is expanded across the profession vocabulary, so 'nurse' also returns Nursing Officers, Nursing Sisters and Midwives. Returns structured profile fields only, never raw CV text. Capped at 50 rows, default 20.",
  inputSchema: {
    query: z5.string().trim().min(1).max(100).optional().describe("Free text matched against name and email."),
    role: z5.string().trim().min(1).max(80).optional().describe("Role/profession term. Expanded across the profession family (nurse -> Registered Nurse, Nurse/Midwife, Midwife, Nursing Assistant)."),
    state: z5.string().trim().min(1).max(80).optional().describe("State filter."),
    lga: z5.string().trim().min(1).max(80).optional().describe("LGA filter."),
    verification_status: z5.enum(["unverified", "in_review", "verified", "failed"]).optional().describe("Filter by verification state."),
    min_years: z5.number().int().min(0).max(60).optional().describe("Minimum years of experience."),
    limit: z5.number().int().min(1).max(50).optional().describe("Max rows (default 20, hard max 50).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, role, state, lga, verification_status, min_years, limit }, ctx) => guard("search_heroes", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    let q = supabaseForUser(ctx).from("mu_people").select(
      "id,full_name,email,phone,profession,profession_source,profession_confidence,current_position,years_experience,state,lga,licensing_body,license_number,license_expiry,right_to_work,verification_state,parse_status,last_activity_at,last_availability_update"
    ).order("last_activity_at", { ascending: false }).limit(Math.min(limit ?? 20, 50));
    if (query) q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
    const family = role ? expandRole(role) : [];
    if (role) {
      const clauses = [
        `profession.ilike.%${role}%`,
        `current_position.ilike.%${role}%`,
        ...family.map((p) => `profession.eq.${p}`)
      ];
      q = q.or(clauses.join(","));
    }
    if (state) q = q.ilike("state", `%${state}%`);
    if (lga) q = q.ilike("lga", `%${lga}%`);
    if (verification_status) q = q.eq("verification_state", verification_status);
    if (typeof min_years === "number") q = q.gte("years_experience", min_years);
    const { data, error } = await q;
    if (error) return fail("Database error", error.message);
    return ok({
      people: data ?? [],
      role_expanded_to: family.length ? family : null,
      limitations: [
        "profession_source tells you where the value came from: 'parsed' means read from a CV and NOT verified; 'self_declared' means the candidate typed it; 'admin_verified' means an admin confirmed it.",
        "last_availability_update tells you when the candidate last touched their availability calendar; null means they never have. For an actual available/unavailable/unknown answer over a date window, use get_hero_profile or match_candidates, which resolve the calendar. Never read a null or stale calendar as unavailable.",
        "years_experience is the candidate's own form value. Where the CV disagrees, the disagreement is recorded in mu_field_conflicts and the form value is kept."
      ]
    });
  })
});

// src/lib/mcp/tools/get_hero_profile.ts
import { defineTool as defineTool6 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z6 } from "npm:zod@^3.25.0";
var get_hero_profile_default = defineTool6({
  name: "get_hero_profile",
  title: "Get Hero profile",
  description: "Fetch a full Match Universe profile: core fields, licence details, verification state, structured facets, documents with verified status, structured parsed fields, outstanding gaps and the resolved availability calendar (available / unavailable / unknown, with freshness). Parsed data is not verified data. Raw CV text is never returned.",
  inputSchema: {
    id: z6.string().uuid().describe("Match Universe person id.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => guard("get_hero_profile", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const today = /* @__PURE__ */ new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const windowFrom = iso(today);
    const windowTo = iso(new Date(today.getTime() + 55 * 864e5));
    const [person, facets, documents, parsed, activity, credentials, readiness, completeness, availDays, availRecurrence] = await Promise.all([
      supabase.from("mu_people").select(
        "id,full_name,email,phone,profession,profession_source,profession_confidence,current_position,years_experience,state,lga,licensing_body,license_number,license_expiry,verification_state,parse_status,parsed_at,candidate_gaps,admin_notes,invited_at,claimed_at,last_activity_at,last_availability_update,created_at"
      ).eq("id", id).maybeSingle(),
      supabase.from("mu_profile_facets").select("facet_type,code,source,confidence,evidence").eq("person_id", id),
      supabase.from("mu_documents").select("id,label,verified,rejected,expires_at,created_at").eq("person_id", id).order("created_at", { ascending: false }),
      supabase.from("mu_parsed_fields").select("field,value,confidence,status,updated_at").eq("person_id", id),
      supabase.from("mu_activity").select("action,detail,actor_name,created_at").eq("person_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("mu_credentials_v").select(
        "credential_type,state,state_rank,claim,claim_source,claim_at,evidence_document_id,evidence_at,verified_at,verification_method,verification_outcome,expires_at,note"
      ).eq("person_id", id),
      supabase.rpc("mu_deployment_readiness", { _person_id: id }),
      supabase.rpc("mu_profile_completeness", { _person_id: id }),
      supabase.from("mu_availability_days").select("slot_date,blocks").eq("person_id", id).gte("slot_date", windowFrom).lte("slot_date", windowTo).order("slot_date", { ascending: true }),
      supabase.from("mu_availability_recurrence").select("weekday,blocks,active").eq("person_id", id)
    ]);
    const err = person.error || facets.error || documents.error || parsed.error || activity.error;
    if (err) return fail("Database error", err.message);
    if (!person.data) return fail("No person found with that id");
    return ok({
      person: person.data,
      credentials: {
        rows: credentials.data ?? [],
        ladder: ["unknown", "declined", "self_declared", "documented", "verified", "expired", "rejected"],
        rule: "Never state a credential without its tier. self_declared means the candidate ticked yes on a form: no document, nobody checked it. documented means a document is on file awaiting review. verified means a named admin reviewed that document and passed it. No external register is checked at any tier.",
        licensing_body: person.data.licensing_body,
        license_number: person.data.license_number,
        license_expiry: person.data.license_expiry
      },
      scores: {
        profile_completeness: completeness.data ?? 0,
        deployment_readiness: readiness.data ?? 0,
        note: "profile_completeness counts fields filled in. deployment_readiness counts credentials backed by a document an admin has passed. Only the second one reflects checked evidence."
      },
      verification_state: person.data.verification_state,
      availability: (() => {
        const free = (b) => !!b && typeof b === "object" && Object.values(b).some((v) => Array.isArray(v) && v.length > 0);
        const days = availDays.data ?? [];
        const recurrence = (availRecurrence.data ?? []).filter((r) => r.active);
        const lastUpdate = person.data.last_availability_update;
        const stated = days.length > 0 || recurrence.length > 0;
        return {
          state: !stated ? "unknown" : days.some((d) => free(d.blocks)) || recurrence.some((r) => free(r.blocks)) ? "available" : "unavailable",
          window: { from: windowFrom, to: windowTo },
          explicit_days: days.map((d) => ({ date: d.slot_date, free: free(d.blocks), blocks: d.blocks })),
          weekly_pattern: recurrence.map((r) => ({ weekday: r.weekday, free: free(r.blocks), blocks: r.blocks })),
          last_update: lastUpdate,
          updated_within_14_days: !!lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 14 * 864e5,
          rule: "Three states only: available, unavailable, unknown. An explicit day beats the weekly pattern. unknown means the candidate has said nothing and must never be reported as unavailable. Quote last_update: a stale calendar is not evidence of current availability."
        };
      })(),
      facets: facets.data ?? [],
      documents: documents.data ?? [],
      parsed_fields: parsed.data ?? [],
      recent_activity: activity.data ?? []
    });
  })
});

// src/lib/mcp/tools/list_opportunities.ts
import { defineTool as defineTool7 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z7 } from "npm:zod@^3.25.0";
var list_opportunities_default = defineTool7({
  name: "list_opportunities",
  title: "List opportunities",
  description: "List Match Universe opportunities (role briefs) with their hard match filters: professions, minimum years, states, LGAs, licence and right-to-work requirements.",
  inputSchema: {
    status: z7.enum(["open", "closed", "draft"]).optional().describe("Filter by opportunity status."),
    query: z7.string().trim().min(1).max(100).optional().describe("Free text matched against the title."),
    limit: z7.number().int().min(1).max(50).optional().describe("Max rows (default 20, hard max 50).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, query, limit }, ctx) => guard("list_opportunities", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    let q = supabaseForUser(ctx).from("matchmaker_opportunities").select(
      "id,slug,title,summary,location,status,match_professions,match_min_years,match_states,match_lgas,match_requires_licence,match_requires_right_to_work,min_licence_evidence,min_right_to_work_evidence,requirements_parsed_at,created_at"
    ).order("created_at", { ascending: false }).limit(Math.min(limit ?? 20, 50));
    if (status) q = q.eq("status", status);
    if (query) q = q.ilike("title", `%${query}%`);
    const { data, error } = await q;
    if (error) return fail("Database error", error.message);
    return ok({ opportunities: data ?? [] });
  })
});

// src/lib/mcp/tools/get_opportunity.ts
import { defineTool as defineTool8 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z8 } from "npm:zod@^3.25.0";
var get_opportunity_default = defineTool8({
  name: "get_opportunity",
  title: "Get opportunity",
  description: "Fetch one opportunity (role brief) with its hard match filters, extracted requirement facets, shortlist and application counts.",
  inputSchema: {
    id: z8.string().uuid().describe("Opportunity id.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => guard("get_opportunity", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const [opp, facets, shortlist] = await Promise.all([
      supabase.from("matchmaker_opportunities").select("*").eq("id", id).maybeSingle(),
      supabase.from("matchmaker_opportunity_facets").select("facet_type,code,requirement").eq("opportunity_id", id),
      supabase.from("mu_shortlists").select("person_id,status,score,note,created_at").eq("opportunity_id", id).order("created_at", { ascending: false }).limit(50)
    ]);
    const err = opp.error || facets.error || shortlist.error;
    if (err) return fail("Database error", err.message);
    if (!opp.data) return fail("No opportunity found with that id");
    return ok({
      opportunity: opp.data,
      requirement_facets: facets.data ?? [],
      shortlist: shortlist.data ?? []
    });
  })
});

// src/lib/mcp/tools/create_opportunity.ts
import { defineTool as defineTool9 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z9 } from "npm:zod@^3.25.0";
function slugify2(input) {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
var create_opportunity_default = defineTool9({
  name: "create_opportunity",
  title: "Create opportunity (draft)",
  description: "Create a new opportunity as a DRAFT only. It is never published or opened by this tool; an admin opens it in the app. Does not contact anyone.",
  inputSchema: {
    title: z9.string().trim().min(3).max(200).describe("Role title."),
    summary: z9.string().trim().max(500).optional().describe("One-line summary."),
    description: z9.string().trim().max(5e3).optional().describe("Full role description."),
    location: z9.string().trim().max(120).optional().describe("Location text."),
    requirements: z9.string().trim().max(5e3).optional().describe("Raw requirements text; an admin can run the parser on it later."),
    slug: z9.string().trim().min(3).max(120).optional().describe("URL slug; auto-generated if omitted.")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, summary, description, location, requirements, slug }, ctx) => guard("create_opportunity", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const finalSlug = slug ? slugify2(slug) : `${slugify2(title)}-${Date.now().toString(36)}`;
    const { data, error } = await supabaseForUser(ctx).from("matchmaker_opportunities").insert({
      title,
      slug: finalSlug,
      summary: summary ?? null,
      description: description ?? null,
      location: location ?? null,
      requirements: requirements ?? null,
      status: "draft",
      created_by: ctx.getUserId()
    }).select("id,title,slug,status,created_at").single();
    if (error) return fail("Database error", error.message);
    return ok({ opportunity: data }, `Created draft opportunity "${data.title}" (id: ${data.id}).`);
  })
});

// src/lib/mcp/tools/match_candidates.ts
import { defineTool as defineTool10 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z10 } from "npm:zod@^3.25.0";
var provenance = (source) => source === "admin_verified" ? "admin verified" : source === "parsed" || source === "cv_parsed" ? "parsed from CV, unverified" : "self declared by the candidate";
var TIER_MEANING = {
  unknown: "never claimed and no document held",
  declined: "the candidate said they do not hold it",
  self_declared: "ticked yes on a form, no document, nobody has checked it",
  documented: "a document is on file, awaiting admin review",
  verified: "an admin reviewed the document and passed it",
  expired: "passed review once but has since lapsed",
  rejected: "an admin reviewed the document and failed it"
};
var TIER_STATES = Object.keys(TIER_MEANING);
var tierOf = (cell) => {
  const s = cell?.state;
  return typeof s === "string" && TIER_STATES.includes(s) ? s : "unknown";
};
function credentialPhrase(label, cell) {
  const state = tierOf(cell);
  const floor = typeof cell?.required_floor === "string" ? cell.required_floor : null;
  const asked = floor && floor !== "none" ? `, this brief asks for ${floor}` : "";
  return `${label}: ${state} (${TIER_MEANING[state]}${asked})`;
}
function reasonFor(r) {
  const b = r.breakdown ?? {};
  const cred = b.credentials ?? {};
  const parts = [
    `Profession ${r.profession ?? "unknown"} (${provenance(b.profession_source)})`,
    `Location ${[r.lga, r.state].filter(Boolean).join(", ") || "unknown"} (${provenance(b.state_source)})`,
    `${b.required_matched ?? 0}/${b.required_total ?? 0} required and ${b.desirable_matched ?? 0}/${b.desirable_total ?? 0} desirable clinical requirements matched`,
    `${b.verified_facets ?? 0} matched facets are admin verified, the rest are parsed from a CV and unverified`,
    `${r.years_experience ?? "unknown"} years experience (self declared on the application form)`,
    credentialPhrase("Licence", cred.licence),
    credentialPhrase("Right to work", cred.right_to_work),
    `Profile completeness ${b.profile_completeness ?? b.completeness ?? 0}% (fields filled in), deployment readiness ${b.deployment_readiness ?? 0}% (credentials backed by a reviewed document)`
  ];
  if (r.missing_required?.length) parts.push(`Missing required clinical facets: ${r.missing_required.join(", ")}`);
  if (r.blockers?.length) parts.push(`Blockers: ${r.blockers.join("; ")}`);
  return parts.join(". ") + ".";
}
var match_candidates_default = defineTool10({
  name: "match_candidates",
  title: "Rank candidates for an opportunity",
  description: "Run the deterministic SQL matcher for an opportunity and return ranked candidates with score, weighted breakdown, blockers, matched/missing requirements and a reason string naming which matched fields are parsed-unverified versus confirmed. Refuses to rank when the opportunity has no criteria: returns unrankable=true naming the missing criteria rather than a plausible-looking shortlist. Ranking is computed in the database, never by the model.",
  inputSchema: {
    opportunity_id: z10.string().uuid().describe("Opportunity id to rank candidates against."),
    limit: z10.number().int().min(1).max(50).optional().describe("Max candidates (default 20, hard max 50)."),
    include_blocked: z10.boolean().optional().describe("Include candidates who fail a hard filter, with their blockers listed (default false).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ opportunity_id, limit, include_blocked }, ctx) => guard("match_candidates", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const db = supabaseForUser(ctx);
    const { data: opp, error: oppError } = await db.from("matchmaker_opportunities").select(
      "id,title,status,location,match_professions,match_states,match_lgas,match_min_years,match_requires_licence,match_requires_right_to_work,min_licence_evidence,min_right_to_work_evidence,requirements_parsed_at"
    ).eq("id", opportunity_id).maybeSingle();
    if (oppError) return fail("Database error", oppError.message);
    if (!opp) return fail("Opportunity not found");
    const { data: facetRows } = await db.from("matchmaker_opportunity_facets").select("facet_type, requirement").eq("opportunity_id", opportunity_id);
    const facets = facetRows ?? [];
    const isClinical = (t) => ["skill", "specialty", "setting"].includes(t);
    const requirement_facets = {
      clinical_required: facets.filter((f) => isClinical(f.facet_type) && f.requirement === "required").length,
      clinical_desirable: facets.filter((f) => isClinical(f.facet_type) && f.requirement === "desirable").length,
      preference: facets.filter((f) => !isClinical(f.facet_type)).length,
      total: facets.length,
      note: "total = clinical_required + clinical_desirable + preference. Only clinical_required is counted in a candidate's breakdown.required_total; seniority and availability are preferences and are scored but never required."
    };
    const facetCount = facets.length;
    const missing = [];
    if (!(opp.match_professions ?? []).length) missing.push("match_professions");
    if (!(opp.match_states ?? []).length && !(opp.match_lgas ?? []).length)
      missing.push("match_states / match_lgas");
    if (opp.match_min_years === null || opp.match_min_years === void 0) missing.push("match_min_years");
    if (!facetCount) missing.push("requirement facets");
    const hasNoCriteria = !(opp.match_professions ?? []).length && !(opp.match_states ?? []).length && !(opp.match_lgas ?? []).length && (opp.match_min_years === null || opp.match_min_years === void 0) && !opp.match_requires_licence && !opp.match_requires_right_to_work && !facetCount;
    if (hasNoCriteria) {
      return ok({
        unrankable: true,
        opportunity: { id: opp.id, title: opp.title, location: opp.location },
        missing_criteria: missing,
        message: "This opportunity has no match criteria, so no ranking is returned. Any shortlist produced now would rank on years of experience, document count and recency alone and would ignore profession and location. Set criteria first (parse the brief in the admin Matches workspace, or call set_opportunity_criteria)."
      });
    }
    const { data, error } = await db.rpc("mu_match_report", {
      _opportunity_id: opportunity_id,
      _limit: Math.min(limit ?? 20, 50)
    });
    if (error) {
      if (String(error.message).toUpperCase().includes("UNRANKABLE")) {
        return ok({ unrankable: true, missing_criteria: missing, message: error.message });
      }
      return fail("Matcher error", error.message);
    }
    const report = data ?? {};
    let rows = (report.candidates ?? []).map((r) => ({ ...r, reason: reasonFor(r) }));
    if (include_blocked) {
      const { data: blocked } = await db.rpc("mu_match_candidates", {
        _opportunity_id: opportunity_id,
        _limit: Math.min(limit ?? 20, 50),
        _include_blocked: true
      });
      rows = (blocked ?? []).map((r) => ({ ...r, reason: reasonFor(r) }));
    }
    const criteria_used = {
      professions: opp.match_professions ?? [],
      states: opp.match_states ?? [],
      lgas: opp.match_lgas ?? [],
      min_years: opp.match_min_years,
      min_licence_evidence: opp.min_licence_evidence ?? "none",
      min_right_to_work_evidence: opp.min_right_to_work_evidence ?? "none",
      partial_criteria: missing.length ? missing : null
    };
    const diagnostics = {
      pool_size: report.pool_size,
      considered: report.considered,
      passed_hard_filters: report.passed,
      best_required_coverage: report.best_required_coverage,
      excluded_by: report.exclusion_reasons ?? {}
    };
    if (!report.passed) {
      const worst = Object.entries(report.exclusion_reasons ?? {}).sort((a, b) => b[1] - a[1]);
      return ok({
        no_matches: true,
        candidates: [],
        criteria_used,
        requirement_facets,
        diagnostics,
        message: `No candidate clears the hard filters for this opportunity. ${report.considered} profiles were considered. ` + (worst.length ? `Largest exclusion: ${worst[0][0]} (${worst[0][1]} candidates). Full breakdown in diagnostics.excluded_by. ` : "") + "Relax or correct a hard filter (profession list, state, minimum years, or the credential evidence tier) and rank again. If the licence tier is 'documented' or 'verified', nobody holds evidence at that tier yet: lower it to 'self_declared' or work the verification queue first."
      });
    }
    return ok({
      candidates: rows,
      criteria_used,
      requirement_facets,
      diagnostics,
      credential_tiers: {
        ladder: ["unknown", "declined", "self_declared", "documented", "verified"],
        meaning: TIER_MEANING,
        rule: "Never present a credential without its tier. self_declared means a tick on a form and nothing more; we cannot check the Nursing and Midwifery Council register, so 'verified' means an admin reviewed an uploaded document."
      },
      limitations: [
        "Ranking is deterministic SQL. The model contributes vocabulary only, never selection or order.",
        "breakdown.credentials gives the derived tier per credential. A licence that reads self_declared has no document behind it.",
        "profile_completeness is fields filled in. deployment_readiness is credentials backed by a reviewed document. They are different numbers and only the second one means anyone checked anything.",
        "Most profile facets are parsed from CVs and are NOT verified. Check verified_facets before presenting anyone to a client.",
        "Seniority and availability are preferences, not clinical requirements: they are scored but never counted in required_total or missing_required.",
        "There is no availability calendar, so nobody here has been filtered on whether they are actually free."
      ]
    });
  })
});

// src/lib/mcp/tools/match_opportunities_for_person.ts
import { defineTool as defineTool11 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z11 } from "npm:zod@^3.25.0";
var match_opportunities_for_person_default = defineTool11({
  name: "match_opportunities_for_person",
  title: "Rank opportunities for a candidate",
  description: "Run the deterministic SQL matcher from a candidate's side and return the opportunities they fit best, with score, breakdown, blockers and matched/missing requirements.",
  inputSchema: {
    person_id: z11.string().uuid().describe("Match Universe person id."),
    limit: z11.number().int().min(1).max(50).optional().describe("Max opportunities (default 20, hard max 50)."),
    include_blocked: z11.boolean().optional().describe("Include opportunities the candidate is blocked from, with blockers listed (default false).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ person_id, limit, include_blocked }, ctx) => guard("match_opportunities_for_person", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx).rpc("mu_match_opportunities_for_person", {
      _person_id: person_id,
      _limit: Math.min(limit ?? 20, 50),
      _include_blocked: include_blocked ?? false
    });
    if (error) return fail("Matcher error", error.message);
    return ok({ opportunities: data ?? [] });
  })
});

// src/lib/mcp/tools/set_opportunity_criteria.ts
import { defineTool as defineTool12 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z12 } from "npm:zod@^3.25.0";

// src/lib/match-taxonomy.ts
var FACET_TYPES = [
  "specialty",
  "setting",
  "skill",
  "seniority",
  "availability",
  "language",
  "patient_group"
];
var SPECIALTIES = [
  "critical_care",
  "accident_emergency",
  "theatre_perioperative",
  "anaesthetics",
  "maternity_obstetrics",
  "gynaecology",
  "neonatal",
  "paediatrics",
  "geriatrics",
  "oncology",
  "haematology",
  "dialysis_renal",
  "cardiology",
  "cardiothoracic",
  "respiratory",
  "orthopaedics",
  "neurology_stroke",
  "burns_plastics",
  "urology",
  "ophthalmic",
  "ent",
  "dermatology",
  "mental_health",
  "learning_disability",
  "substance_misuse",
  "palliative_care",
  "rehabilitation",
  "physiotherapy",
  "occupational_therapy",
  "speech_language",
  "nutrition_dietetics",
  "infection_control",
  "public_health",
  "primary_care",
  "occupational_health",
  "school_health",
  "family_planning",
  "hiv_art",
  "tuberculosis",
  "tropical_infectious_disease",
  "diabetes_endocrine",
  "wound_care",
  "dementia_care",
  "post_surgical_recovery",
  "spinal_injury",
  "general_medicine",
  "general_surgery"
];
var SETTINGS = [
  "home_care",
  "live_in_care",
  "hospital_inpatient",
  "outpatient_clinic",
  "icu",
  "hdu",
  "theatre",
  "emergency_department",
  "dialysis_unit",
  "maternity_unit",
  "community",
  "phc_centre",
  "care_home",
  "hospice",
  "rehabilitation_centre",
  "school",
  "telehealth",
  "ambulance_prehospital",
  "laboratory",
  "imaging",
  "pharmacy",
  "corporate_occupational",
  "ngo_programme"
];
var SKILLS = [
  // Clinical procedures
  "cannulation",
  "venepuncture",
  "phlebotomy",
  "medication_administration",
  "controlled_drugs",
  "injection_administration",
  "insulin_administration",
  "iv_therapy",
  "infusion_pumps",
  "blood_transfusion",
  "wound_dressing",
  "negative_pressure_wound_therapy",
  "suturing",
  "catheterisation",
  "bladder_irrigation",
  "bowel_care",
  "stoma_care",
  "ng_tube_feeding",
  "peg_feeding",
  "tracheostomy_care",
  "suctioning",
  "oxygen_therapy",
  "nebuliser_therapy",
  "ventilator_management",
  "cpap_bipap",
  "chest_drain_care",
  "central_line_care",
  "dialysis_machine_operation",
  "ecg_monitoring",
  "cardiac_monitoring",
  "vital_signs_monitoring",
  "news2_scoring",
  "point_of_care_testing",
  "specimen_collection",
  "blood_glucose_monitoring",
  "pain_assessment",
  "wound_assessment",
  "pressure_area_care",
  "falls_risk_assessment",
  "nutritional_assessment",
  "developmental_assessment",
  // Emergency and resuscitation
  "basic_life_support",
  "advanced_life_support",
  "neonatal_resuscitation",
  "triage",
  "trauma_care",
  "emergency_obstetric_care",
  "defibrillation",
  // Maternal, neonatal and child
  "antenatal_care",
  "labour_management",
  "postnatal_care",
  "breastfeeding_support",
  "immunisation",
  "growth_monitoring",
  "kangaroo_mother_care",
  "phototherapy",
  // Personal and domiciliary care
  "personal_care",
  "bathing_showering",
  "toileting_continence",
  "dressing_grooming",
  "oral_hygiene",
  "meal_preparation",
  "feeding_assistance",
  "mobility_assistance",
  "manual_handling",
  "hoist_operation",
  "housekeeping_support",
  "shopping_errands",
  "companionship",
  "escorting_appointments",
  "sleep_night_care",
  // Condition-specific support
  "diabetes_management",
  "dementia_support",
  "behaviour_that_challenges",
  "epilepsy_seizure_management",
  "stroke_rehabilitation_support",
  "palliative_symptom_control",
  "end_of_life_care",
  "physiotherapy_exercises",
  "speech_swallow_support",
  "respite_care",
  // Governance, safety and administration
  "safeguarding",
  "infection_control_practice",
  "risk_assessment",
  "care_planning",
  "clinical_documentation",
  "electronic_health_records",
  "medication_reconciliation",
  "health_education",
  "family_education",
  "discharge_planning",
  "supervision_mentoring",
  "shift_coordination",
  "audit_quality_improvement",
  "data_reporting"
];
var SENIORITY = ["entry", "junior", "mid", "senior", "lead", "consultant"];
var AVAILABILITY = [
  "full_time",
  "part_time",
  "live_in",
  "day_shift",
  "night_shift",
  "weekends",
  "on_call",
  "locum_ad_hoc",
  "immediate_start"
];
var PATIENT_GROUPS = [
  "older_adults",
  "adults",
  "young_adults",
  "children",
  "infants_neonates",
  "mothers_newborns",
  "dementia",
  "stroke_survivors",
  "palliative_end_of_life",
  "physical_disability",
  "learning_disability_clients",
  "autism",
  "mental_health_clients",
  "post_surgical",
  "chronic_illness",
  "cancer",
  "renal_failure",
  "diabetes_clients",
  "spinal_cord_injury",
  "brain_injury",
  "bariatric",
  "sickle_cell",
  "hiv_clients",
  "respiratory_conditions"
];
var LANGUAGES = [
  "english",
  "yoruba",
  "igbo",
  "hausa",
  "pidgin",
  "french",
  "efik",
  "tiv",
  "kanuri",
  "ijaw",
  "fulfulde",
  "edo",
  "urhobo",
  "ibibio",
  "idoma",
  "nupe",
  "itsekiri",
  "arabic",
  "sign_language"
];
var FACET_VOCABULARY = {
  specialty: SPECIALTIES,
  setting: SETTINGS,
  skill: SKILLS,
  seniority: SENIORITY,
  availability: AVAILABILITY,
  language: LANGUAGES,
  patient_group: PATIENT_GROUPS
};
var isValidFacet = (type, code) => FACET_VOCABULARY[type]?.includes(code) ?? false;

// src/lib/mcp/tools/set_opportunity_criteria.ts
var set_opportunity_criteria_default = defineTool12({
  name: "set_opportunity_criteria",
  title: "Set opportunity match criteria",
  description: "Set the hard filters and requirement facets on an opportunity so the deterministic matcher can rank against it. Without these an opportunity is unrankable. Facet codes must come from the controlled vocabulary; anything outside it is rejected, never stored. Replaces the facets for the opportunity when facets are supplied.",
  inputSchema: {
    opportunity_id: z12.string().uuid(),
    professions: z12.array(z12.string().trim().min(1)).max(20).optional().describe("Acceptable professions, e.g. ['Registered Nurse','Nurse/Midwife']."),
    states: z12.array(z12.string().trim().min(1)).max(20).optional().describe("Acceptable states, without the word 'State' (e.g. 'Oyo')."),
    lgas: z12.array(z12.string().trim().min(1)).max(40).optional(),
    min_years: z12.number().int().min(0).max(40).nullable().optional(),
    requires_licence: z12.boolean().optional().describe("Deprecated shorthand. Prefer min_licence_evidence."),
    requires_right_to_work: z12.boolean().optional().describe("Deprecated shorthand. Prefer min_right_to_work_evidence."),
    min_licence_evidence: z12.enum(["none", "self_declared", "documented", "verified"]).optional().describe(
      "Minimum evidence tier for a licence. none = ignore. self_declared = the candidate ticked yes on a form, nobody checked it. documented = a document is on file. verified = an admin reviewed and passed the document. We cannot check any external register, so 'verified' means an internal document review only."
    ),
    min_right_to_work_evidence: z12.enum(["none", "self_declared", "documented", "verified"]).optional().describe("Minimum evidence tier for right to work. Same ladder as min_licence_evidence."),
    facets: z12.array(
      z12.object({
        facet_type: z12.enum(FACET_TYPES),
        code: z12.string().trim().min(1),
        requirement: z12.enum(["required", "desirable"])
      })
    ).max(60).optional().describe("Requirement facets from the controlled vocabulary. Supplying this replaces existing facets.")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => guard("set_opportunity_criteria", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const db = supabaseForUser(ctx);
    const patch = { requirements_parsed_at: (/* @__PURE__ */ new Date()).toISOString(), requirements_model: "mcp:set_opportunity_criteria" };
    if (input.professions) patch.match_professions = input.professions;
    if (input.states) patch.match_states = input.states;
    if (input.lgas) patch.match_lgas = input.lgas;
    if (input.min_years !== void 0) patch.match_min_years = input.min_years;
    if (input.requires_licence !== void 0) {
      patch.match_requires_licence = input.requires_licence;
      patch.min_licence_evidence = input.requires_licence ? "self_declared" : "none";
    }
    if (input.requires_right_to_work !== void 0) {
      patch.match_requires_right_to_work = input.requires_right_to_work;
      patch.min_right_to_work_evidence = input.requires_right_to_work ? "self_declared" : "none";
    }
    if (input.min_licence_evidence !== void 0) {
      patch.min_licence_evidence = input.min_licence_evidence;
      patch.match_requires_licence = input.min_licence_evidence !== "none";
    }
    if (input.min_right_to_work_evidence !== void 0) {
      patch.min_right_to_work_evidence = input.min_right_to_work_evidence;
      patch.match_requires_right_to_work = input.min_right_to_work_evidence !== "none";
    }
    const { error: updateError } = await db.from("matchmaker_opportunities").update(patch).eq("id", input.opportunity_id);
    if (updateError) return fail("Database error", updateError.message);
    let rejected = [];
    let stored = 0;
    if (input.facets) {
      const valid = input.facets.filter((f) => isValidFacet(f.facet_type, f.code));
      rejected = input.facets.filter((f) => !isValidFacet(f.facet_type, f.code)).map((f) => `${f.facet_type}:${f.code}`);
      const { error: delError } = await db.from("matchmaker_opportunity_facets").delete().eq("opportunity_id", input.opportunity_id);
      if (delError) return fail("Database error", delError.message);
      if (valid.length) {
        const { error: insError } = await db.from("matchmaker_opportunity_facets").insert(
          valid.map((f) => ({
            opportunity_id: input.opportunity_id,
            facet_type: f.facet_type,
            code: f.code,
            requirement: f.requirement
          }))
        );
        if (insError) return fail("Database error", insError.message);
      }
      stored = valid.length;
    }
    const { data: opp } = await db.from("matchmaker_opportunities").select("id,title,match_professions,match_states,match_lgas,match_min_years,match_requires_licence,match_requires_right_to_work,min_licence_evidence,min_right_to_work_evidence").eq("id", input.opportunity_id).maybeSingle();
    return ok({
      opportunity: opp ?? { id: input.opportunity_id },
      facets_stored: stored,
      facets_rejected: rejected,
      note: "Setting criteria is not verification. It only defines what the deterministic matcher filters and scores on."
    });
  })
});

// src/lib/mcp/tools/shortlist_candidate.ts
import { defineTool as defineTool13 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z13 } from "npm:zod@^3.25.0";
var shortlist_candidate_default = defineTool13({
  name: "shortlist_candidate",
  title: "Shortlist a candidate",
  description: "Add a candidate to an opportunity's shortlist with an optional note. Does not contact the candidate or change their record; an admin still reviews the shortlist in the app.",
  inputSchema: {
    opportunity_id: z13.string().uuid().describe("Opportunity to shortlist against."),
    person_id: z13.string().uuid().describe("Candidate to shortlist."),
    note: z13.string().trim().max(1e3).optional().describe("Why this candidate fits.")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ opportunity_id, person_id, note }, ctx) => guard("shortlist_candidate", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx).from("mu_shortlists").insert({
      opportunity_id,
      person_id,
      actor_id: ctx.getUserId(),
      actor_name: ctx.getUserEmail() ?? null,
      note: note ?? null,
      status: "shortlisted"
    }).select("id,opportunity_id,person_id,status,note").single();
    if (error) return fail("Database error", error.message);
    return ok(
      { shortlist: data },
      `Shortlisted candidate ${person_id} for opportunity ${opportunity_id}.`
    );
  })
});

// src/lib/mcp/tools/add_admin_note.ts
import { defineTool as defineTool14 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z14 } from "npm:zod@^3.25.0";
var add_admin_note_default = defineTool14({
  name: "add_admin_note",
  title: "Add admin note",
  description: "Append an admin note to a Hero's activity trail. Visible to admins only; never messages the candidate and never changes verification state.",
  inputSchema: {
    person_id: z14.string().uuid().describe("Match Universe person id."),
    note: z14.string().trim().min(1).max(2e3).describe("Note text."),
    opportunity_id: z14.string().uuid().optional().describe("Optional opportunity this note relates to.")
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ person_id, note, opportunity_id }, ctx) => guard("add_admin_note", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx).from("mu_activity").insert({
      person_id,
      action: "admin_note",
      detail: { note, opportunity_id: opportunity_id ?? null, via: "mcp" },
      actor_id: ctx.getUserId(),
      actor_name: ctx.getUserEmail() ?? null
    }).select("id,person_id,action,detail,created_at").single();
    if (error) return fail("Database error", error.message);
    return ok({ note: data }, `Note added to person ${person_id}.`);
  })
});

// src/lib/mcp/tools/verification_queue.ts
import { defineTool as defineTool15 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z15 } from "npm:zod@^3.25.0";
var verification_queue_default = defineTool15({
  name: "verification_queue",
  title: "Credential verification queue",
  description: "List credentials that have a document attached and are waiting for an admin review, sorted by shortlist pressure (candidates on live shortlists first). This is the only path from a claim to verified evidence: no tool can verify a credential, that stays in the admin UI. Returns the derived tier per credential, never a boolean.",
  inputSchema: {
    limit: z15.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
    only_shortlisted: z15.boolean().optional().describe("Restrict to candidates currently on an active shortlist (default false).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_shortlisted }, ctx) => guard("verification_queue", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const db = supabaseForUser(ctx);
    const { data, error } = await db.rpc("mu_verification_queue", { _limit: Math.min(limit ?? 50, 200) });
    if (error) return fail("Database error", error.message);
    let rows = data ?? [];
    if (only_shortlisted) rows = rows.filter((r) => r.on_active_shortlist);
    return ok({
      queue: rows.map((r) => ({ ...r, document_url: void 0 })),
      count: rows.length,
      notes: [
        "A credential only enters this queue once a document is attached. A yes on an application form never enters it.",
        "Reviewing a document is the only thing that moves a credential from documented to verified, and it is done by a named admin in the Match Universe UI.",
        "We cannot check licences against the Nursing and Midwifery Council register, so 'verified' means an internal document review passed, nothing more."
      ]
    });
  })
});

// src/lib/mcp/tools/db_tables.ts
import { defineTool as defineTool16 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z16 } from "npm:zod@^3.25.0";
var TABLES = [
  "admin_login_log",
  "admin_permissions",
  "admin_settings",
  "audience_groups",
  "audience_members",
  "blog_posts",
  "campaign_events",
  "campaigns",
  "contact_submissions",
  "creator_applications",
  "email_suppressions",
  "heard_volunteers",
  "heard_waitlist",
  "join_applications",
  "matchmaker_applications",
  "matchmaker_email_log",
  "matchmaker_opportunities",
  "matchmaker_opportunity_facets",
  "matchmaker_question_templates",
  "matchmaker_share_events",
  "mu_activity",
  "mu_cv_parses",
  "mu_documents",
  "mu_match_rationales",
  "mu_match_weights",
  "mu_merge_candidates",
  "mu_parsed_fields",
  "mu_people",
  "mu_profile_facets",
  "mu_shortlists",
  "orders",
  "otp_codes",
  "profiles",
  "user_roles"
];
var db_tables_default = defineTool16({
  name: "db_tables",
  title: "List admin tables",
  description: "List the admin database tables reachable over MCP, optionally with a live row count per table. Read-only discovery: use it to see what db_select can target. There is no generic write tool on this server.",
  inputSchema: {
    with_counts: z16.boolean().optional().describe("Also return an exact row count per table (slower).")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ with_counts }, ctx) => guard("db_tables", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    if (!with_counts) return ok({ tables: TABLES });
    const supabase = supabaseForUser(ctx);
    const rows = await Promise.all(
      TABLES.map(async (table) => {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
        return { table, rows: error ? null : count ?? 0, error: error?.message ?? null };
      })
    );
    return ok({ tables: rows });
  })
});

// src/lib/mcp/tools/db_select.ts
import { defineTool as defineTool17 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z18 } from "npm:zod@^3.25.0";

// src/lib/mcp/filters.ts
import { z as z17 } from "npm:zod@^3.25.0";
var filterSchema = z17.object({
  column: z17.string().trim().min(1).max(120),
  op: z17.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains"]).default("eq"),
  value: z17.union([z17.string(), z17.number(), z17.boolean(), z17.null(), z17.array(z17.union([z17.string(), z17.number()]))]).describe("Value to compare. Use an array with op 'in'. Use null with op 'is'.")
});
function applyFilters(query, filters) {
  let q = query;
  for (const f of filters ?? []) {
    const op = f.op ?? "eq";
    if (op === "in") {
      q = q.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
    } else if (op === "like" || op === "ilike") {
      q = q[op](f.column, String(f.value));
    } else {
      q = q[op](f.column, f.value);
    }
  }
  return q;
}

// src/lib/mcp/tools/db_select.ts
var db_select_default = defineTool17({
  name: "db_select",
  title: "Read any admin table",
  description: "Read rows from any admin table with column selection, filters, ordering and paging. Embedded relations are supported in `columns` using PostgREST syntax, e.g. 'id,full_name,mu_documents(label,url,verified)'. Runs under the signed-in admin's RLS scope.",
  inputSchema: {
    table: z18.string().trim().min(1).max(80).describe("Table name, e.g. 'mu_people'. Use db_tables to discover."),
    columns: z18.string().trim().min(1).max(2e3).optional().describe("PostgREST select string. Default '*'."),
    filters: z18.array(filterSchema).max(20).optional().describe("Filters combined with AND."),
    or: z18.string().trim().min(1).max(500).optional().describe('Optional PostgREST OR expression, e.g. "full_name.ilike.%ada%,email.ilike.%ada%".'),
    order_by: z18.string().trim().min(1).max(120).optional().describe("Column to order by."),
    ascending: z18.boolean().optional().describe("Order direction (default false = newest/highest first)."),
    limit: z18.number().int().min(1).max(500).optional().describe("Max rows (default 50, cap 500)."),
    offset: z18.number().int().min(0).max(1e5).optional().describe("Rows to skip for paging."),
    count: z18.boolean().optional().describe("Also return the total matching row count.")
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table, columns, filters, or, order_by, ascending, limit, offset, count }, ctx) => guard("db_select", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const take = limit ?? 50;
    const skip = offset ?? 0;
    let query = supabaseForUser(ctx).from(table).select(columns ?? "*", count ? { count: "exact" } : void 0);
    query = applyFilters(query, filters);
    if (or) query = query.or(or);
    if (order_by) {
      query = query.order(
        order_by,
        { ascending: ascending ?? false }
      );
    }
    query = query.range(skip, skip + take - 1);
    const { data, error, count: total } = await query;
    if (error) return fail("Database error", error.message);
    return ok({ table, rows: data ?? [], returned: data?.length ?? 0, total: total ?? null });
  })
});

// src/lib/mcp/tools/storage_browse.ts
import { defineTool as defineTool18 } from "npm:@lovable.dev/mcp-js@0.22.2";
import { z as z19 } from "npm:zod@^3.25.0";
var storage_browse_default = defineTool18({
  name: "storage_browse",
  title: "Browse stored files",
  description: "List file names in a storage bucket ('applications', 'blog-images', 'creator-uploads'). Listing never returns file contents or links. A signed URL is minted only when sign=true AND a written reason is supplied, and only for the single file named in file, never for a whole folder. Candidate documents are private: do not mint a link unless an admin has asked for that specific document. Runs under the signed-in admin's storage policies and every signing is recorded in the reason field of the response.",
  inputSchema: {
    bucket: z19.string().trim().min(1).max(60).describe("Bucket name."),
    path: z19.string().trim().max(300).optional().describe("Folder prefix inside the bucket (default root)."),
    limit: z19.number().int().min(1).max(200).optional().describe("Max entries (default 50)."),
    search: z19.string().trim().min(1).max(120).optional().describe("Filename search term."),
    sign: z19.boolean().optional().describe("Mint a 1-hour signed URL for one named file. Requires both file and reason."),
    file: z19.string().trim().min(1).max(300).optional().describe("Exact file name inside path to sign. Required when sign=true."),
    reason: z19.string().trim().min(12).max(300).optional().describe("Why this specific document needs to be opened. Required when sign=true.")
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ bucket, path, limit, search, sign, file, reason }, ctx) => guard("storage_browse", async () => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const storage = supabaseForUser(ctx).storage.from(bucket);
    if (!sign) {
      const { data, error: error2 } = await storage.list(path ?? "", {
        limit: limit ?? 50,
        search,
        sortBy: { column: "created_at", order: "desc" }
      });
      if (error2) return fail("Storage error", error2.message);
      return ok({
        bucket,
        path: path ?? "",
        files: (data ?? []).map((f) => ({ name: f.name, created_at: f.created_at, size: f.metadata?.size ?? null })),
        note: "Listing only. No links are issued here. To open one document, call again with sign=true, the exact file name and a reason."
      });
    }
    if (!file) return fail("sign=true requires the exact file name to sign; bulk signing is not available");
    if (!reason) return fail("sign=true requires a written reason for opening this candidate document");
    const prefix = path ? `${path.replace(/\/$/, "")}/` : "";
    const { data: url, error } = await storage.createSignedUrl(`${prefix}${file}`, 3600);
    if (error) return fail("Storage error", error.message);
    return ok({
      bucket,
      file: `${prefix}${file}`,
      signed_url: url?.signedUrl ?? null,
      expires_in_seconds: 3600,
      reason,
      note: "One document, one hour. Do not repeat this link in a summary or share it outside the admin session."
    });
  })
});

// src/lib/mcp/index.ts
var projectRef = "eylgffhvyuykafxydrul";
var mcp_default = defineMcp({
  name: "medic-connect-care",
  title: "MEDIC CONNECT CARE",
  version: "0.11.0",
  instructions: "Tools for the Medic Connect admin platform, including the Match Universe talent pool. Content: `list_blog_posts`, `create_blog_draft`, `list_campaigns`, `list_enquiries`. Talent pool: `search_heroes`, `get_hero_profile`, `list_opportunities`, `get_opportunity`, `create_opportunity` (draft only), `match_candidates` (refuses to rank an opportunity with no criteria, returning unrankable=true, and returns no_matches=true with an exclusion breakdown when criteria exist but every candidate is filtered out; credentials are an evidence ladder: unknown, declined, self_declared, documented, verified, expired, rejected, and an opportunity sets a minimum tier rather than a boolean), `set_opportunity_criteria`, `match_opportunities_for_person`, `shortlist_candidate`, `add_admin_note`, `verification_queue` (documents waiting on review, ranked by shortlist pressure). Facet counts come in exactly two quantities: `requirement_facets` (what the brief asks for: clinical_required, clinical_desirable, preference, total) and each candidate's `breakdown.required_matched` / `required_total` (what that person matched, counted only against clinical required facets). Ranking is always computed by the deterministic SQL matcher, never by the model - use `match_candidates` rather than eyeballing profiles. Parsed CV data is not verified data; say so when summarising. Never state a credential without its tier: self_declared means the candidate ticked yes on a form with no document and no check, and no external register is ever consulted. profile_completeness (fields filled in) and deployment_readiness (credentials backed by a reviewed document) are different numbers; quote both. No tool here messages a candidate, changes verification state, publishes content or confirms a deployment - those stay in the admin UI. Availability is a real calendar now, resolved per opportunity window into exactly three states: available (the candidate said they are free), unavailable (the candidate said they are booked) and unknown (the candidate said nothing). Unknown never excludes anyone and must never be reported as a no - report it as 'not stated'. A candidate is only ruled out on availability when the brief sets min_availability_evidence='available' and the calendar positively says unavailable. Always quote calendar freshness (updated_within_14_days / last_update) beside any availability claim: a two-month-old calendar is not evidence. Result sizes are capped; never assume a full pool dump. All calls run under the signed-in admin's RLS scope. This server is READ-ONLY over the general backend: `db_tables` (discover tables and row counts) and `db_select` (read any table with filters, embeds and paging) exist for questions the purpose-built tools cannot answer. There is no generic insert, update, delete or function-call tool: every write goes through a named tool with its own rules (`create_blog_draft`, `create_opportunity`, `set_opportunity_criteria`, `shortlist_candidate`, `add_admin_note`) or through the admin UI. Verification state can only be changed by an admin in the UI. `storage_browse` lists file names only; opening a candidate document requires sign=true plus the exact file name and a written reason, and issues a single one-hour link.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    // Given explicitly so the isolate skips the OAuth discovery round trip and
    // fetches the key set directly: one outbound request on cold start, not two.
    jwksUri: `https://${projectRef}.supabase.co/auth/v1/.well-known/jwks.json`,
    acceptedAudiences: "authenticated"
  }),
  tools: [
    list_blog_posts_default,
    create_blog_draft_default,
    list_campaigns_default,
    list_enquiries_default,
    search_heroes_default,
    get_hero_profile_default,
    list_opportunities_default,
    get_opportunity_default,
    create_opportunity_default,
    match_candidates_default,
    match_opportunities_for_person_default,
    set_opportunity_criteria_default,
    shortlist_candidate_default,
    add_admin_note_default,
    verification_queue_default,
    db_tables_default,
    db_select_default,
    storage_browse_default
  ]
});

// lovable-mcp-supabase-entry.ts
import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@0.22.2/stacks/supabase";
Deno.serve(createSupabaseHandler(mcp_default, { functionName: "mcp" }));
