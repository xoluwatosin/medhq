import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "list_opportunities",
  title: "List opportunities",
  description:
    "List Match Universe opportunities (role briefs) with their hard match filters: professions, minimum years, states, LGAs, licence and right-to-work requirements.",
  inputSchema: {
    status: z.enum(["open", "closed", "draft"]).optional().describe("Filter by opportunity status."),
    query: z.string().trim().min(1).max(100).optional().describe("Free text matched against the title."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20, hard max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, query, limit }, ctx) =>
    guard("list_opportunities", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      let q = supabaseForUser(ctx)
        .from("matchmaker_opportunities")
        .select(
          "id,slug,title,summary,location,status,match_professions,match_min_years,match_states,match_lgas,match_requires_licence,match_requires_right_to_work,min_licence_evidence,min_right_to_work_evidence,requirements_parsed_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(Math.min(limit ?? 20, 50));

      if (status) q = q.eq("status", status);
      if (query) q = q.ilike("title", `%${query}%`);

      const { data, error } = await q;
      if (error) return fail("Database error", error.message);
      return ok({ opportunities: data ?? [] });
    }),
});
