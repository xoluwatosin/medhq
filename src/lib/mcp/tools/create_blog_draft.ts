import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default defineTool({
  name: "create_blog_draft",
  title: "Create blog draft",
  description:
    "Create a new draft blog post for Medic Connect as the signed-in admin. Always saved as draft with approval_status 'pending'; a super-admin still publishes it.",
  inputSchema: {
    title: z.string().trim().min(3).max(200).describe("Post title."),
    content: z.string().min(1).describe("HTML or Markdown body of the post."),
    excerpt: z.string().trim().min(1).max(500).describe("Short excerpt shown in listings (required)."),
    category: z.string().trim().min(1).max(80).optional().describe("Category label (default 'General')."),
    author: z.string().trim().min(1).max(120).optional().describe("Author byline (default 'Medic Connect')."),
    slug: z.string().trim().min(3).max(120).optional().describe("URL slug; auto-generated from title if omitted."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, excerpt, category, author, slug }, ctx) =>
    guard("create_blog_draft", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const finalSlug = slug ? slugify(slug) : `${slugify(title)}-${Date.now().toString(36)}`;
      const { data, error } = await supabaseForUser(ctx)
        .from("blog_posts")
        .insert({
          title,
          slug: finalSlug,
          content,
          excerpt,
          category: category ?? "General",
          author: author ?? "Medic Connect",
          status: "draft",
          published_at: null,
          approval_status: "pending",
          created_by: ctx.getUserId(),
          created_by_name: ctx.getUserEmail() ?? null,
        })
        .select("id,title,slug,status,approval_status,created_at")
        .single();
      if (error) return fail("Database error", error.message);
      return ok({ post: data }, `Created draft "${data.title}" (id: ${data.id}, slug: ${data.slug}).`);
    }),
});
