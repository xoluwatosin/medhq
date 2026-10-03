import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

export default defineTool({
  name: "storage_browse",
  title: "Browse stored files",
  description:
    "List file names in a storage bucket ('applications', 'blog-images', 'creator-uploads'). Listing never returns file contents or links. A signed URL is minted only when sign=true AND a written reason is supplied, and only for the single file named in file, never for a whole folder. Candidate documents are private: do not mint a link unless an admin has asked for that specific document. Runs under the signed-in admin's storage policies and every signing is recorded in the reason field of the response.",
  inputSchema: {
    bucket: z.string().trim().min(1).max(60).describe("Bucket name."),
    path: z.string().trim().max(300).optional().describe("Folder prefix inside the bucket (default root)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max entries (default 50)."),
    search: z.string().trim().min(1).max(120).optional().describe("Filename search term."),
    sign: z
      .boolean()
      .optional()
      .describe("Mint a 1-hour signed URL for one named file. Requires both file and reason."),
    file: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .optional()
      .describe("Exact file name inside path to sign. Required when sign=true."),
    reason: z
      .string()
      .trim()
      .min(12)
      .max(300)
      .optional()
      .describe("Why this specific document needs to be opened. Required when sign=true."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ bucket, path, limit, search, sign, file, reason }, ctx) =>
    guard("storage_browse", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const storage = supabaseForUser(ctx).storage.from(bucket);

      if (!sign) {
        const { data, error } = await storage.list(path ?? "", {
          limit: limit ?? 50,
          search,
          sortBy: { column: "created_at", order: "desc" },
        });
        if (error) return fail("Storage error", error.message);
        return ok({
          bucket,
          path: path ?? "",
          files: (data ?? []).map((f) => ({ name: f.name, created_at: f.created_at, size: f.metadata?.size ?? null })),
          note: "Listing only. No links are issued here. To open one document, call again with sign=true, the exact file name and a reason.",
        });
      }

      if (!file) return fail("sign=true requires the exact file name to sign; bulk signing is not available");
      if (!reason) return fail("sign=true requires a written reason for opening this candidate document");

      const prefix = path ? `${path.replace(/\/$/, "")}/` : "";
      const { data: url, error } = await storage.createSignedUrl(`${prefix}${file}`, 3600);
      if (error) return fail("Storage error", error.message);

      return ok({
        bucket,
        file: `${prefix}${file}`,
        signed_url: url?.signedUrl ?? null,
        expires_in_seconds: 3600,
        reason,
        note: "One document, one hour. Do not repeat this link in a summary or share it outside the admin session.",
      });
    }),
});
