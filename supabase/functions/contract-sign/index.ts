// The public signing door.
//
// A contract issued to somebody who has no account yet is reached by an
// unguessable link. Everything here runs server side so that the record of the
// signature, the address it came from and the device used, is captured by us
// and not offered up by the browser.
import { createClient } from "npm:@supabase/supabase-js@2";
import { withOpsLog } from "../_shared/ops-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("cf-connecting-ip") ||
  null;

Deno.serve(withOpsLog("contract-sign", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "get");
    const token = String(body.token ?? "");
    if (!token || token.length < 32) return json({ error: "This link is not valid." }, 400);

    const db = admin();
    const { data: contract, error } = await db
      .from("mu_contracts")
      .select("*")
      .eq("sign_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!contract) return json({ error: "This link is no longer valid." }, 404);
    if (contract.token_expires_at && new Date(contract.token_expires_at) < new Date()) {
      return json({ error: "This link has expired. Ask us to send a fresh one." }, 410);
    }

    const { data: person } = await db
      .from("mu_people")
      .select("id, full_name, email")
      .eq("id", contract.person_id)
      .maybeSingle();

    const publicView = {
      id: contract.id,
      status: contract.status,
      fields: contract.issued_fields ?? contract.fields ?? {},
      clauses: contract.issued_clauses ?? contract.clauses ?? [],
      annexes: contract.annexes ?? [],
      is_clinical: contract.is_clinical,
      signed_name: contract.signed_name,
      signed_at: contract.signed_at,
      signature_image: contract.signature_image,
      countersigned_name: contract.countersigned_name,
      countersigned_at: contract.countersigned_at,
      countersignature_image: contract.countersignature_image,
      person_name: person?.full_name ?? null,
      person_email: person?.email ?? null,
    };

    if (action === "get") {
      if (contract.status === "issued") {
        await db.rpc("mu_contract_log", {
          _contract_id: contract.id,
          _event_type: "viewed",
          _detail: "Opened the signing link",
          _payload: {},
          _actor_name: person?.full_name ?? null,
          _ip: clientIp(req),
          _user_agent: req.headers.get("user-agent"),
          _actor_role: "person",
        });
      }
      return json({ contract: publicView });
    }

    if (action === "sign") {
      if (contract.status !== "issued") {
        return json({ error: "This contract is not awaiting a signature." }, 409);
      }
      const name = String(body.name ?? "").trim();
      const method = body.method === "drawn" ? "drawn" : "typed";
      const signatureImage = typeof body.signature_image === "string" ? body.signature_image : null;
      if (!name) return json({ error: "Please type your full name." }, 400);
      if (body.consent !== true) return json({ error: "Please tick the confirmation box." }, 400);
      if (method === "drawn" && !signatureImage) return json({ error: "Please draw your signature." }, 400);

      const { error: signError } = await db.rpc("mu_contract_sign_by_token", {
        _token: token,
        _signed_name: name,
        _method: method,
        _signature_image: signatureImage,
        _ip: clientIp(req),
        _user_agent: req.headers.get("user-agent"),
      });
      if (signError) throw signError;

      return json({
        contract: { ...publicView, status: "signed", signed_name: name, signed_at: new Date().toISOString(), signature_image: signatureImage },
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("contract-sign", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}));
