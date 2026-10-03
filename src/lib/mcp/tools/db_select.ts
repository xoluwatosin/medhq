import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { applyFilters, filterSchema } from "../filters";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "db_select",
  title: "Read any admin table",
  description:
    "Read rows from any admin table with column selection, filters, ordering and paging. Embedded relations are supported in `columns` using PostgREST syntax, e.g. 'id,full_name,mu_documents(label,url,verified)'. Runs under the signed-in admin's RLS scope.",
  inputSchema: {
    table: z.string().trim().min(1).max(80).describe("Table name, e.g. 'mu_people'. Use db_tables to discover."),
    columns: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .optional()
      .describe("PostgREST select string. Default '*'."),
    filters: z.array(filterSchema).max(20).optional().describe("Filters combined with AND."),
    or: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
      .describe("Optional PostgREST OR expression, e.g. \"full_name.ilike.%ada%,email.ilike.%ada%\"."),
    order_by: z.string().trim().min(1).max(120).optional().describe("Column to order by."),
    ascending: z.boolean().optional().describe("Order direction (default false = newest/highest first)."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 50, cap 500)."),
    offset: z.number().int().min(0).max(100000).optional().describe("Rows to skip for paging."),
    count: z.boolean().optional().describe("Also return the total matching row count."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table, columns, filters, or, order_by, ascending, limit, offset, count }, ctx) =>
    guard("db_select", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const take = limit ?? 50;
      const skip = offset ?? 0;

      let query = supabaseForUser(ctx)
        .from(table)
        .select(columns ?? "*", count ? { count: "exact" } : undefined) as never;

      query = applyFilters(query as never, filters) as never;
      if (or) query = (query as { or: (v: string) => unknown }).or(or) as never;
      if (order_by) {
        query = (query as { order: (c: string, o: { ascending: boolean }) => unknown }).order(
          order_by,
          { ascending: ascending ?? false },
        ) as never;
      }
      query = (query as { range: (a: number, b: number) => unknown }).range(skip, skip + take - 1) as never;

      const { data, error, count: total } = (await query) as {
        data: unknown[] | null;
        error: { message: string } | null;
        count: number | null;
      };
      if (error) return fail("Database error", error.message);
      return ok({ table, rows: data ?? [], returned: data?.length ?? 0, total: total ?? null });
    }),
});
