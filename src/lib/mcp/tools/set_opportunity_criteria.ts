import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";
import { FACET_TYPES, isValidFacet } from "../../match-taxonomy";

export default defineTool({
  name: "set_opportunity_criteria",
  title: "Set opportunity match criteria",
  description:
    "Set the hard filters and requirement facets on an opportunity so the deterministic matcher can rank against it. Without these an opportunity is unrankable. Facet codes must come from the controlled vocabulary; anything outside it is rejected, never stored. Replaces the facets for the opportunity when facets are supplied.",
  inputSchema: {
    opportunity_id: z.string().uuid(),
    professions: z.array(z.string().trim().min(1)).max(20).optional().describe("Acceptable professions, e.g. ['Registered Nurse','Nurse/Midwife']."),
    states: z.array(z.string().trim().min(1)).max(20).optional().describe("Acceptable states, without the word 'State' (e.g. 'Oyo')."),
    lgas: z.array(z.string().trim().min(1)).max(40).optional(),
    min_years: z.number().int().min(0).max(40).nullable().optional(),
    requires_licence: z.boolean().optional().describe("Deprecated shorthand. Prefer min_licence_evidence."),
    requires_right_to_work: z.boolean().optional().describe("Deprecated shorthand. Prefer min_right_to_work_evidence."),
    min_licence_evidence: z
      .enum(["none", "self_declared", "documented", "verified"])
      .optional()
      .describe(
        "Minimum evidence tier for a licence. none = ignore. self_declared = the candidate ticked yes on a form, nobody checked it. documented = a document is on file. verified = an admin reviewed and passed the document. We cannot check any external register, so 'verified' means an internal document review only.",
      ),
    min_right_to_work_evidence: z
      .enum(["none", "self_declared", "documented", "verified"])
      .optional()
      .describe("Minimum evidence tier for right to work. Same ladder as min_licence_evidence."),
    facets: z
      .array(
        z.object({
          facet_type: z.enum(FACET_TYPES as unknown as [string, ...string[]]),
          code: z.string().trim().min(1),
          requirement: z.enum(["required", "desirable"]),
        }),
      )
      .max(60)
      .optional()
      .describe("Requirement facets from the controlled vocabulary. Supplying this replaces existing facets."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) =>
    guard("set_opportunity_criteria", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const db = supabaseForUser(ctx);

      const patch: Record<string, unknown> = { requirements_parsed_at: new Date().toISOString(), requirements_model: "mcp:set_opportunity_criteria" };
      if (input.professions) patch.match_professions = input.professions;
      if (input.states) patch.match_states = input.states;
      if (input.lgas) patch.match_lgas = input.lgas;
      if (input.min_years !== undefined) patch.match_min_years = input.min_years;
      if (input.requires_licence !== undefined) {
        patch.match_requires_licence = input.requires_licence;
        patch.min_licence_evidence = input.requires_licence ? "self_declared" : "none";
      }
      if (input.requires_right_to_work !== undefined) {
        patch.match_requires_right_to_work = input.requires_right_to_work;
        patch.min_right_to_work_evidence = input.requires_right_to_work ? "self_declared" : "none";
      }
      if (input.min_licence_evidence !== undefined) {
        patch.min_licence_evidence = input.min_licence_evidence;
        patch.match_requires_licence = input.min_licence_evidence !== "none";
      }
      if (input.min_right_to_work_evidence !== undefined) {
        patch.min_right_to_work_evidence = input.min_right_to_work_evidence;
        patch.match_requires_right_to_work = input.min_right_to_work_evidence !== "none";
      }

      const { error: updateError } = await db
        .from("matchmaker_opportunities")
        .update(patch)
        .eq("id", input.opportunity_id);
      if (updateError) return fail("Database error", updateError.message);

      let rejected: string[] = [];
      let stored = 0;
      if (input.facets) {
        const valid = input.facets.filter((f) => isValidFacet(f.facet_type, f.code));
        rejected = input.facets
          .filter((f) => !isValidFacet(f.facet_type, f.code))
          .map((f) => `${f.facet_type}:${f.code}`);

        const { error: delError } = await db
          .from("matchmaker_opportunity_facets")
          .delete()
          .eq("opportunity_id", input.opportunity_id);
        if (delError) return fail("Database error", delError.message);

        if (valid.length) {
          const { error: insError } = await db.from("matchmaker_opportunity_facets").insert(
            valid.map((f) => ({
              opportunity_id: input.opportunity_id,
              facet_type: f.facet_type,
              code: f.code,
              requirement: f.requirement,
            })),
          );
          if (insError) return fail("Database error", insError.message);
        }
        stored = valid.length;
      }

      const { data: opp } = await db
        .from("matchmaker_opportunities")
        .select("id,title,match_professions,match_states,match_lgas,match_min_years,match_requires_licence,match_requires_right_to_work,min_licence_evidence,min_right_to_work_evidence")
        .eq("id", input.opportunity_id)
        .maybeSingle();

      return ok({
        opportunity: opp ?? { id: input.opportunity_id },
        facets_stored: stored,
        facets_rejected: rejected,
        note: "Setting criteria is not verification. It only defines what the deterministic matcher filters and scores on.",
      });
    }),
});
