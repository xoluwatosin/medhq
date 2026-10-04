// Records edge function failures for the System health screen.
//
// Wrap a handler with withOpsLog("function-name", handler). Unhandled errors and
// 5xx responses are written to public.ops_function_errors: the function name,
// the status and a short message. Request bodies and personal data are never
// recorded. A failure to record never changes the response.

const MAX_MESSAGE = 300;

async function record(functionName: string, status: number, message: string): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/ops_function_errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ function_name: functionName, status, message: message.slice(0, MAX_MESSAGE) }),
    });
  } catch {
    // Recording is best effort.
  }
}

/** The error field of a JSON error body, or the start of a text body. */
async function describe(res: Response): Promise<string> {
  try {
    const text = await res.clone().text();
    try {
      const body = JSON.parse(text);
      const value = body?.error ?? body?.message;
      if (typeof value === "string") return value;
    } catch {
      // Not JSON.
    }
    return text || `Responded ${res.status}`;
  } catch {
    return `Responded ${res.status}`;
  }
}

export function withOpsLog(
  functionName: string,
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const res = await handler(req);
      if (res.status >= 500) await record(functionName, res.status, await describe(res));
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await record(functionName, 500, `Unhandled: ${message}`);
      return new Response(JSON.stringify({ error: "Something went wrong." }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  };
}
