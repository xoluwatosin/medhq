import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { kitEmailFromMarkdown } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

function buildNewPostEmail(title: string, excerpt: string, slug: string): string {
  const safeSlug = encodeURIComponent(String(slug || ""));
  const readUrl = `${SITE_URL}/blog/${safeSlug}`;
  return kitEmailFromMarkdown({
    eyebrow: "The Bridge",
    title,
    standfirst: "New writing from Medic Connect.",
    preheader: excerpt,
    markdown: `${excerpt}

[[cta:Read the piece|${readUrl}]]`,
    footnote: `You are receiving this because you asked to hear when we publish. Unsubscribe at ${SITE_URL}/unsubscribe.`,
  });
}

async function sendBatch(emails: string[], subject: string, html: string, resendApiKey: string) {
  const batchSize = 10;
  let totalSent = 0;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const promises = batch.map((email) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Medic Connect <notifications@medicconnect.co>",
          to: [email],
          subject,
          html,
          tags: emailTags("new-post"),
        }),
      })
    );
    const results = await Promise.allSettled(promises);
    totalSent += results.filter((r) => r.status === "fulfilled" && (r as any).value.ok).length;
  }
  return totalSent;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch the blog post
    const { data: post, error: postErr } = await supabase.from("blog_posts").select("*").eq("id", post_id).single();
    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch all audience members, deduplicate by email
    const { data: members } = await supabase.from("audience_members").select("email");
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: "No audience members found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const uniqueEmails = [...new Set(members.map((m: any) => m.email.toLowerCase()))];
    const html = buildNewPostEmail(post.title, post.excerpt, post.slug);
    const subject = `New from Medic Connect: ${post.title}`;

    const totalSent = await sendBatch(uniqueEmails, subject, html, resendApiKey);

    // Mark post as notified
    await supabase.from("blog_posts").update({ subscribers_notified: true }).eq("id", post_id);

    return new Response(JSON.stringify({ success: true, total_sent: totalSent, total_recipients: uniqueEmails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
