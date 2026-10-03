import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: require a logged-in admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Privilege gate: only the super admin may force-sign-out other admins.
    // Mirrors invite-admin and admin-password-reset.
    const { data: isSuper, error: superErr } = await adminClient
      .rpc("is_super_admin", { _user_id: user.id });
    if (superErr || isSuper !== true) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin only" }), {
        status: 403,
        headers: corsHeaders,
      });
    }


    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: corsHeaders });
    }

    // Ban the user briefly to invalidate all refresh tokens
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: "1s",
    });
    if (banError) {
      return new Response(JSON.stringify({ error: banError.message }), { status: 500, headers: corsHeaders });
    }

    // Immediately unban
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (unbanError) {
      return new Response(JSON.stringify({ error: unbanError.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
