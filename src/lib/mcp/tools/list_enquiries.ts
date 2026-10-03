import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "list_enquiries",
  title: "List contact enquiries",
  description:
    "List recent contact form submissions from the Medic Connect website. Admin-only via RLS. Returns name, email, phone, service, message, status and attribution.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
    status: z.string().trim().min(1).max(40).optional().describe("Filter by enquiry status."),
    include_archived: z.boolean().optional().describe("Include archived enquiries (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, include_archived }, ctx) =>
    guard("list_enquiries", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      let q = supabaseForUser(ctx)
        .from("contact_submissions")
        .select("id,name,email,phone,service,message,status,archived,utm_source,utm_campaign,created_at")
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);
      if (status) q = q.eq("status", status);
      if (!include_archived) q = q.eq("archived", false);
      const { data, error } = await q;
      if (error) return fail("Database error", error.message);
      return ok({ enquiries: data ?? [] });
    }),
});
