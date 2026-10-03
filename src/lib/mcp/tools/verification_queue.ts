import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "verification_queue",
  title: "Credential verification queue",
  description:
    "List credentials that have a document attached and are waiting for an admin review, sorted by shortlist pressure (candidates on live shortlists first). This is the only path from a claim to verified evidence: no tool can verify a credential, that stays in the admin UI. Returns the derived tier per credential, never a boolean.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
    only_shortlisted: z
      .boolean()
      .optional()
      .describe("Restrict to candidates currently on an active shortlist (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_shortlisted }, ctx) =>
    guard("verification_queue", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const db = supabaseForUser(ctx);

      const { data, error } = await db.rpc("mu_verification_queue", { _limit: Math.min(limit ?? 50, 200) });
      if (error) return fail("Database error", error.message);

      let rows = (data ?? []) as any[];
      if (only_shortlisted) rows = rows.filter((r) => r.on_active_shortlist);

      return ok({
        queue: rows.map((r) => ({ ...r, document_url: undefined })),
        count: rows.length,
        notes: [
          "A credential only enters this queue once a document is attached. A yes on an application form never enters it.",
          "Reviewing a document is the only thing that moves a credential from documented to verified, and it is done by a named admin in the Match Universe UI.",
          "We cannot check licences against the Nursing and Midwifery Council register, so 'verified' means an internal document review passed, nothing more.",
        ],
      });
    }),
});
