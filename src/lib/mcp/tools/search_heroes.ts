import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

// A search for "nurse" must find "Nursing Officer", "Nursing Sister" and
// "Midwife". Free-text substring matching on current_position loses all three,
// so a role term is expanded into the structured profession vocabulary first.
const ROLE_FAMILIES: { test: RegExp; professions: string[] }[] = [
  {
    test: /nurse|nursing|rn\b|nmcn|bnsc|sister|matron/i,
    professions: ["Registered Nurse", "Nurse/Midwife", "Midwife", "Nursing Assistant"],
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
  { test: /psycholog|counsel/i, professions: ["Psychologist / Counsellor"] },
];

const expandRole = (role: string): string[] =>
  ROLE_FAMILIES.filter((f) => f.test.test(role)).flatMap((f) => f.professions);

export default defineTool({
  name: "search_heroes",
  title: "Search talent pool",
  description:
    "Search the Match Universe talent pool (Heroes) by name, email, profession, state, LGA, verification state or minimum years. A role term is expanded across the profession vocabulary, so 'nurse' also returns Nursing Officers, Nursing Sisters and Midwives. Returns structured profile fields only, never raw CV text. Capped at 50 rows, default 20.",
  inputSchema: {
    query: z.string().trim().min(1).max(100).optional().describe("Free text matched against name and email."),
    role: z.string().trim().min(1).max(80).optional().describe("Role/profession term. Expanded across the profession family (nurse -> Registered Nurse, Nurse/Midwife, Midwife, Nursing Assistant)."),
    state: z.string().trim().min(1).max(80).optional().describe("State filter."),
    lga: z.string().trim().min(1).max(80).optional().describe("LGA filter."),
    verification_status: z
      .enum(["unverified", "in_review", "verified", "failed"])
      .optional()
      .describe("Filter by verification state."),
    min_years: z.number().int().min(0).max(60).optional().describe("Minimum years of experience."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20, hard max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, role, state, lga, verification_status, min_years, limit }, ctx) =>
    guard("search_heroes", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      let q = supabaseForUser(ctx)
        .from("mu_people")
        .select(
          "id,full_name,email,phone,profession,profession_source,profession_confidence,current_position,years_experience,state,lga,licensing_body,license_number,license_expiry,right_to_work,verification_state,parse_status,last_activity_at,last_availability_update",
        )
        .order("last_activity_at", { ascending: false })
        .limit(Math.min(limit ?? 20, 50));

      if (query) q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);

      const family = role ? expandRole(role) : [];
      if (role) {
        const clauses = [
          `profession.ilike.%${role}%`,
          `current_position.ilike.%${role}%`,
          ...family.map((p) => `profession.eq.${p}`),
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
          "years_experience is the candidate's own form value. Where the CV disagrees, the disagreement is recorded in mu_field_conflicts and the form value is kept.",
        ],
      });
    }),
});
