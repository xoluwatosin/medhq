import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "list_blog_posts",
  title: "List blog posts",
  description:
    "List Medic Connect blog posts visible to the signed-in user (respects RLS). Note: status, approval_status and published_at are independent fields and can drift.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
    status: z.string().trim().min(1).max(40).optional().describe("Filter by post status (draft, published, scheduled)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) =>
    guard("list_blog_posts", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      let q = supabaseForUser(ctx)
        .from("blog_posts")
        .select("id,title,slug,category,author,status,approval_status,archived,published_at,created_at")
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return fail("Database error", error.message);
      return ok({ posts: data ?? [] });
    }),
});
