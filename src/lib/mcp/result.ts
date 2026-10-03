// Shared MCP result helpers: every tool must return a structured error with a
// readable message. No uncaught exception may reach the transport.

export type McpResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function fail(message: string, detail?: unknown): McpResult {
  const text = detail ? `${message}: ${safe(detail)}` : message;
  return { content: [{ type: "text", text }], isError: true, structuredContent: { error: text } };
}

export function ok(payload: Record<string, unknown>, text?: string): McpResult {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function safe(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Wrap a handler body so any thrown error becomes a structured MCP error. */
export async function guard(
  toolName: string,
  run: () => Promise<McpResult>,
): Promise<McpResult> {
  try {
    return await run();
  } catch (err) {
    return fail(`${toolName} failed`, err);
  }
}
