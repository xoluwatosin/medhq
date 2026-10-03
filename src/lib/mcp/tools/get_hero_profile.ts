import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "get_hero_profile",
  title: "Get Hero profile",
  description:
    "Fetch a full Match Universe profile: core fields, licence details, verification state, structured facets, documents with verified status, structured parsed fields, outstanding gaps and the resolved availability calendar (available / unavailable / unknown, with freshness). Parsed data is not verified data. Raw CV text is never returned.",
  inputSchema: {
    id: z.string().uuid().describe("Match Universe person id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) =>
    guard("get_hero_profile", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const supabase = supabaseForUser(ctx);

      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const windowFrom = iso(today);
      const windowTo = iso(new Date(today.getTime() + 55 * 86400000));

      const [person, facets, documents, parsed, activity, credentials, readiness, completeness, availDays, availRecurrence] = await Promise.all([
        supabase
          .from("mu_people")
          .select(
            "id,full_name,email,phone,profession,profession_source,profession_confidence,current_position,years_experience,state,lga,licensing_body,license_number,license_expiry,verification_state,parse_status,parsed_at,candidate_gaps,admin_notes,invited_at,claimed_at,last_activity_at,last_availability_update,created_at",
          )
          .eq("id", id)
          .maybeSingle(),

        supabase
          .from("mu_profile_facets")
          .select("facet_type,code,source,confidence,evidence")
          .eq("person_id", id),
        supabase
          .from("mu_documents")
          .select("id,label,verified,rejected,expires_at,created_at")
          .eq("person_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("mu_parsed_fields")
          .select("field,value,confidence,status,updated_at")
          .eq("person_id", id),
        supabase
          .from("mu_activity")
          .select("action,detail,actor_name,created_at")
          .eq("person_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("mu_credentials_v")
          .select(
            "credential_type,state,state_rank,claim,claim_source,claim_at,evidence_document_id,evidence_at,verified_at,verification_method,verification_outcome,expires_at,note",
          )
          .eq("person_id", id),
        supabase.rpc("mu_deployment_readiness", { _person_id: id }),
        supabase.rpc("mu_profile_completeness", { _person_id: id }),
        supabase
          .from("mu_availability_days")
          .select("slot_date,blocks")
          .eq("person_id", id)
          .gte("slot_date", windowFrom)
          .lte("slot_date", windowTo)
          .order("slot_date", { ascending: true }),
        supabase
          .from("mu_availability_recurrence")
          .select("weekday,blocks,active")
          .eq("person_id", id),
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
          license_expiry: person.data.license_expiry,
        },
        scores: {
          profile_completeness: completeness.data ?? 0,
          deployment_readiness: readiness.data ?? 0,
          note: "profile_completeness counts fields filled in. deployment_readiness counts credentials backed by a document an admin has passed. Only the second one reflects checked evidence.",
        },
        verification_state: person.data.verification_state,
        availability: (() => {
          const free = (b: unknown) =>
            !!b && typeof b === "object" &&
            Object.values(b as Record<string, unknown>).some((v) => Array.isArray(v) && v.length > 0);
          const days = (availDays.data ?? []) as { slot_date: string; blocks: unknown }[];
          const recurrence = ((availRecurrence.data ?? []) as { weekday: number; blocks: unknown; active: boolean }[])
            .filter((r) => r.active);
          const lastUpdate = person.data.last_availability_update as string | null;
          const stated = days.length > 0 || recurrence.length > 0;
          return {
            state: !stated ? "unknown" : days.some((d) => free(d.blocks)) || recurrence.some((r) => free(r.blocks))
              ? "available"
              : "unavailable",
            window: { from: windowFrom, to: windowTo },
            explicit_days: days.map((d) => ({ date: d.slot_date, free: free(d.blocks), blocks: d.blocks })),
            weekly_pattern: recurrence.map((r) => ({ weekday: r.weekday, free: free(r.blocks), blocks: r.blocks })),
            last_update: lastUpdate,
            updated_within_14_days: !!lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 14 * 86400000,
            rule: "Three states only: available, unavailable, unknown. An explicit day beats the weekly pattern. unknown means the candidate has said nothing and must never be reported as unavailable. Quote last_update: a stale calendar is not evidence of current availability.",
          };
        })(),

        facets: facets.data ?? [],
        documents: documents.data ?? [],
        parsed_fields: parsed.data ?? [],
        recent_activity: activity.data ?? [],
      });

    }),
});
