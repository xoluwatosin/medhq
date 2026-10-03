import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "add_admin_note",
  title: "Add admin note",
  description:
    "Append an admin note to a Hero's activity trail. Visible to admins only; never messages the candidate and never changes verification state.",
  inputSchema: {
    person_id: z.string().uuid().describe("Match Universe person id."),
    note: z.string().trim().min(1).max(2000).describe("Note text."),
    opportunity_id: z.string().uuid().optional().describe("Optional opportunity this note relates to."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ person_id, note, opportunity_id }, ctx) =>
    guard("add_admin_note", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const { data, error } = await supabaseForUser(ctx)
        .from("mu_activity")
        .insert({
          person_id,
          action: "admin_note",
          detail: { note, opportunity_id: opportunity_id ?? null, via: "mcp" },
          actor_id: ctx.getUserId(),
          actor_name: ctx.getUserEmail() ?? null,
        })
        .select("id,person_id,action,detail,created_at")
        .single();
      if (error) return fail("Database error", error.message);
      return ok({ note: data }, `Note added to person ${person_id}.`);
    }),
});
