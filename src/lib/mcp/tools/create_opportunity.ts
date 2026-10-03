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
  name: "create_opportunity",
  title: "Create opportunity (draft)",
  description:
    "Create a new opportunity as a DRAFT only. It is never published or opened by this tool; an admin opens it in the app. Does not contact anyone.",
  inputSchema: {
    title: z.string().trim().min(3).max(200).describe("Role title."),
    summary: z.string().trim().max(500).optional().describe("One-line summary."),
    description: z.string().trim().max(5000).optional().describe("Full role description."),
    location: z.string().trim().max(120).optional().describe("Location text."),
    requirements: z.string().trim().max(5000).optional().describe("Raw requirements text; an admin can run the parser on it later."),
    slug: z.string().trim().min(3).max(120).optional().describe("URL slug; auto-generated if omitted."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, summary, description, location, requirements, slug }, ctx) =>
    guard("create_opportunity", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const finalSlug = slug ? slugify(slug) : `${slugify(title)}-${Date.now().toString(36)}`;
      const { data, error } = await supabaseForUser(ctx)
        .from("matchmaker_opportunities")
        .insert({
          title,
          slug: finalSlug,
          summary: summary ?? null,
          description: description ?? null,
          location: location ?? null,
          requirements: requirements ?? null,
          status: "draft",
          created_by: ctx.getUserId(),
        })
        .select("id,title,slug,status,created_at")
        .single();
      if (error) return fail("Database error", error.message);
      return ok({ opportunity: data }, `Created draft opportunity "${data.title}" (id: ${data.id}).`);
    }),
});
