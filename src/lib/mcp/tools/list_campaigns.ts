import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "list_campaigns",
  title: "List campaigns",
  description:
    "List email campaigns visible to the signed-in admin (respects RLS). Returns title, subject, status, approval status, schedule and send stats.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
    status: z.string().trim().min(1).max(40).optional().describe("Filter by campaign status."),
    include_archived: z.boolean().optional().describe("Include archived campaigns (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, include_archived }, ctx) =>
    guard("list_campaigns", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      let q = supabaseForUser(ctx)
        .from("campaigns")
        .select(
          "id,title,subject,status,approval_status,audience_type,scheduled_for,sent_at,total_recipients,total_delivered,total_opened,total_clicked,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);
      if (status) q = q.eq("status", status);
      if (!include_archived) q = q.eq("archived", false);
      const { data, error } = await q;
      if (error) return fail("Database error", error.message);
      return ok({ campaigns: data ?? [] });
    }),
});
