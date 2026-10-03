import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

// Public-schema tables reachable through the Data API for a signed-in admin.
const TABLES = [
  "admin_login_log",
  "admin_permissions",
  "admin_settings",
  "audience_groups",
  "audience_members",
  "blog_posts",
  "campaign_events",
  "campaigns",
  "contact_submissions",
  "creator_applications",
  "email_suppressions",
  "heard_volunteers",
  "heard_waitlist",
  "join_applications",
  "matchmaker_applications",
  "matchmaker_email_log",
  "matchmaker_opportunities",
  "matchmaker_opportunity_facets",
  "matchmaker_question_templates",
  "matchmaker_share_events",
  "mu_activity",
  "mu_cv_parses",
  "mu_documents",
  "mu_match_rationales",
  "mu_match_weights",
  "mu_merge_candidates",
  "mu_parsed_fields",
  "mu_people",
  "mu_profile_facets",
  "mu_shortlists",
  "orders",
  "otp_codes",
  "profiles",
  "user_roles",
] as const;

export default defineTool({
  name: "db_tables",
  title: "List admin tables",
  description:
    "List the admin database tables reachable over MCP, optionally with a live row count per table. Read-only discovery: use it to see what db_select can target. There is no generic write tool on this server.",
  inputSchema: {
    with_counts: z.boolean().optional().describe("Also return an exact row count per table (slower)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ with_counts }, ctx) =>
    guard("db_tables", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      if (!with_counts) return ok({ tables: TABLES });

      const supabase = supabaseForUser(ctx);
      const rows = await Promise.all(
        TABLES.map(async (table) => {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });
          return { table, rows: error ? null : (count ?? 0), error: error?.message ?? null };
        }),
      );
      return ok({ tables: rows });
    }),
});

export { TABLES };
