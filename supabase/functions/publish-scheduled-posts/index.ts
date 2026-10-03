import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Accept either: (1) shared CRON_SECRET for scheduled invocations,
    // or (2) an authenticated admin manually triggering a flush.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let authorized = false;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      authorized = true;
    } else if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (roleData) authorized = true;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all scheduled posts whose published_at has passed
    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("id, title")
      .eq("status", "scheduled")
      .lte("published_at", new Date().toISOString());

    if (error) {
      throw new Error(error.message);
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = posts.map((p: any) => p.id);
    const { error: updateErr } = await supabase
      .from("blog_posts")
      .update({ status: "published" })
      .in("id", ids);

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    console.log(`Published ${ids.length} scheduled post(s): ${posts.map((p: any) => p.title).join(", ")}`);

    return new Response(JSON.stringify({ published: ids.length, titles: posts.map((p: any) => p.title) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("publish-scheduled-posts error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
