import { z } from "zod";

// Shared filter grammar for the generic admin tools. Filters are applied through
// the PostgREST query builder (never raw SQL), so values stay parameterised.
export const filterSchema = z.object({
  column: z.string().trim().min(1).max(120),
  op: z
    .enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains"])
    .default("eq"),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number()]))])
    .describe("Value to compare. Use an array with op 'in'. Use null with op 'is'."),
});

export type Filter = z.infer<typeof filterSchema>;

type Builder = {
  eq: (c: string, v: unknown) => Builder;
  neq: (c: string, v: unknown) => Builder;
  gt: (c: string, v: unknown) => Builder;
  gte: (c: string, v: unknown) => Builder;
  lt: (c: string, v: unknown) => Builder;
  lte: (c: string, v: unknown) => Builder;
  like: (c: string, v: string) => Builder;
  ilike: (c: string, v: string) => Builder;
  is: (c: string, v: unknown) => Builder;
  in: (c: string, v: readonly unknown[]) => Builder;
  contains: (c: string, v: unknown) => Builder;
};

export function applyFilters<T extends Builder>(query: T, filters: Filter[] | undefined): T {
  let q = query;
  for (const f of filters ?? []) {
    const op = f.op ?? "eq";
    if (op === "in") {
      q = q.in(f.column, Array.isArray(f.value) ? f.value : [f.value as unknown]) as T;
    } else if (op === "like" || op === "ilike") {
      q = q[op](f.column, String(f.value)) as T;
    } else {
      q = q[op](f.column, f.value) as T;
    }
  }
  return q;
}
