import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "match_opportunities_for_person",
  title: "Rank opportunities for a candidate",
  description:
    "Run the deterministic SQL matcher from a candidate's side and return the opportunities they fit best, with score, breakdown, blockers and matched/missing requirements.",
  inputSchema: {
    person_id: z.string().uuid().describe("Match Universe person id."),
    limit: z.number().int().min(1).max(50).optional().describe("Max opportunities (default 20, hard max 50)."),
    include_blocked: z
      .boolean()
      .optional()
      .describe("Include opportunities the candidate is blocked from, with blockers listed (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ person_id, limit, include_blocked }, ctx) =>
    guard("match_opportunities_for_person", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const { data, error } = await supabaseForUser(ctx).rpc("mu_match_opportunities_for_person", {
        _person_id: person_id,
        _limit: Math.min(limit ?? 20, 50),
        _include_blocked: include_blocked ?? false,
      });
      if (error) return fail("Matcher error", error.message);
      return ok({ opportunities: data ?? [] });
    }),
});
