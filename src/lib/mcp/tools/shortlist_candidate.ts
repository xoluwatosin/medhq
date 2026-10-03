import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "shortlist_candidate",
  title: "Shortlist a candidate",
  description:
    "Add a candidate to an opportunity's shortlist with an optional note. Does not contact the candidate or change their record; an admin still reviews the shortlist in the app.",
  inputSchema: {
    opportunity_id: z.string().uuid().describe("Opportunity to shortlist against."),
    person_id: z.string().uuid().describe("Candidate to shortlist."),
    note: z.string().trim().max(1000).optional().describe("Why this candidate fits."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ opportunity_id, person_id, note }, ctx) =>
    guard("shortlist_candidate", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const { data, error } = await supabaseForUser(ctx)
        .from("mu_shortlists")
        .insert({
          opportunity_id,
          person_id,
          actor_id: ctx.getUserId(),
          actor_name: ctx.getUserEmail() ?? null,
          note: note ?? null,
          status: "shortlisted",
        })
        .select("id,opportunity_id,person_id,status,note")
        .single();
      if (error) return fail("Database error", error.message);
      return ok(
        { shortlist: data },
        `Shortlisted candidate ${person_id} for opportunity ${opportunity_id}.`,
      );
    }),
});
