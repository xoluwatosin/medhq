// The database hands back at most 1,000 rows per request and says nothing
// about the rest. Lists that can grow past that (the audience, email events)
// read through this, a page at a time, until a short page says it is done.
// The query must be ordered, so pages never overlap or skip.

const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function selectAll<T>(page: (from: number, to: number) => Page<T>, cap = 100_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
