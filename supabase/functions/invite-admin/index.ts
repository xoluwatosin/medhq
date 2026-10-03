import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitParagraph, kitButton } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_ID = "af2fac7f-86db-483f-831e-3cb38454a30c";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const callerId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims.email as string) ?? "";
    const isSuperAdmin = callerId === SUPER_ADMIN_ID;

    // The super admin, or a named delegate holding "admin_access".
    let canManage = isSuperAdmin;
    if (!canManage) {
      const { data: callerPerm } = await adminClient
        .from("admin_permissions")
        .select("permissions, is_active")
        .eq("user_id", callerId)
        .maybeSingle();
      canManage =
        !!callerPerm &&
        callerPerm.is_active !== false &&
        Array.isArray(callerPerm.permissions) &&
        callerPerm.permissions.includes("admin_access");
    }
    if (!canManage) {
      return new Response(JSON.stringify({ error: "Forbidden: you cannot manage admin access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, displayName, permissions, requiresBlogApproval, requiresCampaignApproval, resend, personId } = await req.json();

    const requestedPermissions: string[] = Array.isArray(permissions) ? permissions : [];
    if (!isSuperAdmin && requestedPermissions.includes("admin_access")) {
      return new Response(JSON.stringify({ error: "Only the super admin can grant the right to manage admin access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recordAccessChange = async (
      targetUserId: string,
      targetEmail: string,
      action: string,
      after: string[],
      before: string[] = [],
    ) => {
      await adminClient.from("admin_access_log").insert({
        actor_user_id: callerId,
        actor_email: callerEmail,
        target_user_id: targetUserId,
        target_email: targetEmail,
        action,
        permissions_before: before,
        permissions_after: after,
      });
    };

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectTo = `${SITE_URL}/set-password`;

    // ---- RESEND PATH: generate a fresh invite link and send via Resend ----
    if (resend) {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });

      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const actionLink = linkData?.properties?.action_link;
      if (!actionLink) {
        return new Response(JSON.stringify({ error: "Could not generate invite link" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "Email service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Medic Connect <noreply@medicconnect.co>",
          to: [email],
          subject: "You're Invited to Medic Connect Admin",
        tags: emailTags("invite-admin"),
          html: kitEmail({
            eyebrow: "Admin Centre",
            title: "Your invitation",
            standfirst: "You have been invited to the Medic Connect Admin Centre.",
            preheader: "Set your password to join the Medic Connect Admin Centre.",
            bodyHtml:
              kitParagraph("Set a password to activate your account. Sign in afterwards with this email address and a security code sent to your inbox.") +
              kitButton("Set your password", actionLink),
            footnote: "If you did not expect this invitation, you can safely ignore this email.",
          }),
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        return new Response(JSON.stringify({ error: `Email send failed: ${errBody}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, resent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- GRANT OR INVITE ----
    // A person who already signs in (candidate or staff portal) keeps that one
    // account and simply gains admin areas. Only a brand new email is invited.
    const lookup = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    const lookupBody = lookup.ok ? await lookup.json() : { users: [] };
    const existing = (lookupBody.users ?? []).find(
      (u: { email?: string }) => (u.email ?? "").toLowerCase() === String(email).toLowerCase(),
    );

    let userId: string;
    let granted = false;

    if (existing) {
      userId = existing.id;
      granted = true;
    } else {
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { display_name: displayName || email },
        redirectTo,
      });

      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = inviteData.user.id;
    }

    if (userId === SUPER_ADMIN_ID && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "The super admin's access cannot be changed here" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId === callerId && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "You cannot change your own access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: previous } = await adminClient
      .from("admin_permissions")
      .select("permissions")
      .eq("user_id", userId)
      .maybeSingle();


    await adminClient.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role" }
    );

    await adminClient.from("admin_permissions").upsert(
      {
        user_id: userId,
        email,
        display_name: displayName || email,
        permissions: requestedPermissions,
        requires_blog_approval: requiresBlogApproval ?? true,
        requires_campaign_approval: requiresCampaignApproval ?? true,
        is_active: true,
      },
      { onConflict: "user_id" }
    );

    // Staff invited from the workforce register are linked back to the person
    // record they already have, so nobody ends up with two profiles.
    if (personId) {
      await adminClient
        .from("mu_people")
        .update({ auth_user_id: userId, invited_at: new Date().toISOString() })
        .eq("id", personId);
    }

    await adminClient.from("profiles").upsert(
      { user_id: userId, display_name: displayName || email },
      { onConflict: "user_id" }
    );

    await recordAccessChange(
      userId,
      email,
      granted ? "granted_existing_account" : "invited",
      requestedPermissions,
      Array.isArray(previous?.permissions) ? (previous!.permissions as string[]) : [],
    );

    return new Response(JSON.stringify({ success: true, userId, granted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
