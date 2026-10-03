import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "get_opportunity",
  title: "Get opportunity",
  description:
    "Fetch one opportunity (role brief) with its hard match filters, extracted requirement facets, shortlist and application counts.",
  inputSchema: {
    id: z.string().uuid().describe("Opportunity id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) =>
    guard("get_opportunity", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const supabase = supabaseForUser(ctx);

      const [opp, facets, shortlist] = await Promise.all([
        supabase.from("matchmaker_opportunities").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("matchmaker_opportunity_facets")
          .select("facet_type,code,requirement")
          .eq("opportunity_id", id),
        supabase
          .from("mu_shortlists")
          .select("person_id,status,score,note,created_at")
          .eq("opportunity_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const err = opp.error || facets.error || shortlist.error;
      if (err) return fail("Database error", err.message);
      if (!opp.data) return fail("No opportunity found with that id");

      return ok({
        opportunity: opp.data,
        requirement_facets: facets.data ?? [],
        shortlist: shortlist.data ?? [],
      });
    }),
});
