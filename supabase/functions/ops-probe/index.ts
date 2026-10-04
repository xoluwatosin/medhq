// Checks that each outside service answers with our key, for System health.
// Runs every 30 minutes from the ops-probe job, authorised by the alert run key.
// Each probe is a cheap read: no email is sent, no charge is made.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withOpsLog } from "../_shared/ops-log.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const TIMEOUT_MS = 10_000;
const SLOW_MS = 4_000;

type ProbeStatus = "up" | "degraded" | "down" | "not_configured";
interface ProbeResult {
  service: string;
  status: ProbeStatus;
  latency_ms: number | null;
  message: string | null;
}

interface Probe {
  service: string;
  secret: string;
  request: (key: string) => Request;
  /** Some failures mean the key works but is limited; say so rather than "down". */
  interpret?: (res: Response, text: string) => ProbeStatus | null;
}

const PROBES: Probe[] = [
  {
    service: "resend",
    secret: "RESEND_API_KEY",
    request: (key) => new Request("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } }),
    // A sending-only key cannot list domains, but it is a valid key.
    interpret: (res, text) => (res.status === 401 && text.includes("restricted_api_key") ? "up" : null),
  },
  {
    service: "paystack",
    secret: "PAYSTACK_SECRET_KEY",
    request: (key) => new Request("https://api.paystack.co/balance", { headers: { Authorization: `Bearer ${key}` } }),
  },
  {
    service: "anthropic",
    secret: "ANTHROPIC_API_KEY",
    request: (key) =>
      new Request("https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      }),
  },
  {
    service: "google_maps",
    secret: "GOOGLE_MAPS_API_KEY",
    request: (key) =>
      new Request("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({ input: "Lagos" }),
      }),
  },
];

async function run(probe: Probe): Promise<ProbeResult> {
  const key = Deno.env.get(probe.secret);
  if (!key) return { service: probe.service, status: "not_configured", latency_ms: null, message: `${probe.secret} is not set` };

  const started = performance.now();
  try {
    const res = await fetch(probe.request(key), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const latency = Math.round(performance.now() - started);
    const text = await res.text();
    const special = probe.interpret?.(res, text);
    if (special) return { service: probe.service, status: special, latency_ms: latency, message: null };

    if (res.ok) {
      return latency > SLOW_MS
        ? { service: probe.service, status: "degraded", latency_ms: latency, message: `Slow: ${latency} ms` }
        : { service: probe.service, status: "up", latency_ms: latency, message: null };
    }
    if (res.status === 401 || res.status === 403) {
      return { service: probe.service, status: "down", latency_ms: latency, message: `Key rejected (${res.status})` };
    }
    if (res.status === 429 || res.status === 529) {
      return { service: probe.service, status: "degraded", latency_ms: latency, message: `Rate limited or overloaded (${res.status})` };
    }
    return { service: probe.service, status: "down", latency_ms: latency, message: `Responded ${res.status}: ${text.slice(0, 150)}` };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return {
      service: probe.service,
      status: "down",
      latency_ms: null,
      message: timedOut ? `No answer within ${TIMEOUT_MS / 1000} seconds` : `Could not connect: ${String(e).slice(0, 150)}`,
    };
  }
}

Deno.serve(withOpsLog("ops-probe", async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const sentKey = req.headers.get("x-run-key");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = bearer === serviceKey;
  if (!allowed && sentKey) {
    const { data: keyOk } = await admin.rpc("job_key_check", { p_name: "admin_alert_key", p_value: sentKey });
    allowed = keyOk === true;
  }
  if (!allowed) return json({ error: "Not permitted." }, 401);

  const results = await Promise.all(PROBES.map(run));
  const { error } = await admin.from("ops_probe_results").insert(results);
  if (error) return json({ error: error.message }, 500);
  return json({ results });
}));
