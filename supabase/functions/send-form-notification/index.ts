import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitFacts, kitMarkdown } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { withOpsLog } from "../_shared/ops-log.ts";

// Audience group names
const CONTACT_GROUP_NAME = "Contact Enquiries";
const APPLICATION_GROUP_NAME = "Job Applicants";
const CREATOR_GROUP_NAME = "Creator Applicants";

// Restrict CORS to a strict explicit allowlist (no suffix matching)
// Extra exact origins (staging, previews, local dev), comma-separated.
const EXTRA_ORIGINS = (Deno.env.get("EXTRA_ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set<string>([
  "https://medicconnect.co",
  "https://www.medicconnect.co",
  ...EXTRA_ORIGINS,
]);

const DEFAULT_ORIGIN = "https://medicconnect.co";

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// HTML escape function to prevent XSS in emails
function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Input validation schemas
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;
const MAX_PHONE_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_SERVICE_LENGTH = 50;
const MAX_ROLE_LENGTH = 100;
const MAX_EXPERIENCE_LENGTH = 100;
const MAX_COUNTRY_LENGTH = 100;
const MAX_SOCIAL_LINKS_LENGTH = 1000;
const MAX_URL_LENGTH = 2000;

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

function validatePhone(phone: string): boolean {
  const phoneRegex = /^[0-9+\-\s()]+$/;
  return phoneRegex.test(phone) && phone.length <= MAX_PHONE_LENGTH;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface FormNotificationRequest {
  formType: "contact" | "application" | "creator_application";
  data: {
    name: string;
    email: string;
    phone: string;
    service?: string;
    message?: string;
    role?: string;
    experience?: string;
    country?: string;
    socialLinks?: string;
    portfolioUrl?: string;
    rateCardUrl?: string;
  };
}

// Add submitter to audience group
async function addToAudience(
  supabase: any,
  email: string,
  name: string,
  groupName: string,
  source: string
): Promise<void> {
  try {
    // Look up group by name
    const { data: group } = await supabase
      .from("audience_groups")
      .select("id")
      .eq("name", groupName)
      .single();

    if (!group) {
      console.error(`Audience group "${groupName}" not found`);
      return;
    }

    await supabase.from("audience_members").upsert(
      { email, name, group_id: group.id, source },
      { onConflict: "email,group_id", ignoreDuplicates: true }
    );
  } catch (err) {
    console.error("Failed to add to audience:", err);
  }
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    // Fail fast for disallowed origins so browsers don't silently block the POST.
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request origin
    if (origin && !isAllowedOrigin(origin)) {
      console.error("Request from unauthorized origin:", origin);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify the request came through Supabase (has apikey header)
    const apikey = req.headers.get("apikey");
    if (!apikey) {
      console.error("Missing apikey header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const NOTIFICATION_EMAIL = Deno.env.get("NOTIFICATION_EMAIL");
    if (!NOTIFICATION_EMAIL) {
      throw new Error("NOTIFICATION_EMAIL is not configured");
    }

    // Create service-role Supabase client for audience inserts
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { formType, data }: FormNotificationRequest = await req.json();

    // Server-side input validation
    if (!data.name || data.name.length > MAX_NAME_LENGTH) {
      return new Response(JSON.stringify({ error: "Invalid name" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!data.email || !validateEmail(data.email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!data.phone || !validatePhone(data.phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.message && data.message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: "Message too long" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.service && data.service.length > MAX_SERVICE_LENGTH) {
      return new Response(JSON.stringify({ error: "Invalid service" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.role && data.role.length > MAX_ROLE_LENGTH) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.experience && data.experience.length > MAX_EXPERIENCE_LENGTH) {
      return new Response(JSON.stringify({ error: "Invalid experience" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.country && data.country.length > MAX_COUNTRY_LENGTH) {
      return new Response(JSON.stringify({ error: "Invalid country" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.socialLinks && data.socialLinks.length > MAX_SOCIAL_LINKS_LENGTH) {
      return new Response(JSON.stringify({ error: "Social links too long" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.portfolioUrl && data.portfolioUrl.length > MAX_URL_LENGTH) {
      return new Response(JSON.stringify({ error: "Portfolio URL too long" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.portfolioUrl && !isSafeUrl(data.portfolioUrl)) {
      return new Response(JSON.stringify({ error: "Portfolio URL must use http or https" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.rateCardUrl && data.rateCardUrl.length > MAX_URL_LENGTH) {
      return new Response(JSON.stringify({ error: "Rate card URL too long" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (data.rateCardUrl && !isSafeUrl(data.rateCardUrl)) {
      return new Response(JSON.stringify({ error: "Rate card URL must use http or https" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const timestamp = new Date().toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      dateStyle: "full",
      timeStyle: "short",
    });

    let subject: string;
    let htmlContent: string;

    // Escape all user input before inserting into HTML
    const safeName = escapeHtml(data.name);
    const safeEmail = escapeHtml(data.email);
    const safePhone = escapeHtml(data.phone);
    const safeService = escapeHtml(data.service);
    const safeMessage = escapeHtml(data.message);
    const safeRole = escapeHtml(data.role);
    const safeExperience = escapeHtml(data.experience);
    const safeCountry = escapeHtml(data.country);
    const safeSocialLinks = escapeHtml(data.socialLinks);
    const safePortfolioUrl = escapeHtml(data.portfolioUrl);
    const safeRateCardUrl = escapeHtml(data.rateCardUrl);

    let audienceGroupName: string;
    let audienceSource: string;

    if (formType === "contact") {
      audienceGroupName = CONTACT_GROUP_NAME;
      audienceSource = "contact_form";
      subject = `New contact enquiry: ${safeService || "General"}`;
      htmlContent = kitEmail({
        eyebrow: "Inbox",
        title: "New contact enquiry",
        standfirst: `${data.name || "Someone"} wrote in through the website.`,
        preheader: subject,
        bodyHtml: [
          kitFacts([
            { label: "Name", value: data.name || "Not given" },
            { label: "Email", value: data.email || "Not given" },
            { label: "Phone", value: data.phone || "Not given" },
            { label: "Service", value: data.service || "Not specified" },
            { label: "Received", value: timestamp },
          ]),
          kitMarkdown(`## Their message\n\n${data.message || "No message provided."}`),
        ].join("\n"),
        footnote: "Sent automatically when a contact form is completed on medicconnect.co.",
      });
    } else if (formType === "creator_application") {
      audienceGroupName = CREATOR_GROUP_NAME;
      audienceSource = "creator_form";
      subject = `New creator application: ${safeName}`;
      htmlContent = kitEmail({
        eyebrow: "Creator programme",
        title: "New creator application",
        standfirst: `${data.name || "A creator"} applied to the programme.`,
        preheader: subject,
        bodyHtml: [
          kitFacts([
            { label: "Name", value: data.name || "Not given" },
            { label: "Email", value: data.email || "Not given" },
            { label: "Phone", value: data.phone || "Not given" },
            { label: "Country", value: data.country || "Not given" },
            { label: "Social", value: data.socialLinks || "Not given" },
            { label: "Portfolio", value: data.portfolioUrl || "Not provided" },
            { label: "Rate card", value: data.rateCardUrl || "Not provided" },
            { label: "Received", value: timestamp },
          ]),
          kitMarkdown(`## Why Medic Connect\n\n${data.message || "No answer provided."}`),
        ].join("\n"),
        footnote: "Sent automatically when a creator application is submitted on medicconnect.co.",
      });
    } else {
      audienceGroupName = APPLICATION_GROUP_NAME;
      audienceSource = "application_form";
      subject = `New application: ${safeRole || "General"}`;
      htmlContent = kitEmail({
        eyebrow: "Match Universe",
        title: "New application",
        standfirst: `${data.name || "A candidate"} applied to join the network.`,
        preheader: subject,
        bodyHtml: [
          kitFacts([
            { label: "Name", value: data.name || "Not given" },
            { label: "Email", value: data.email || "Not given" },
            { label: "Phone", value: data.phone || "Not given" },
            { label: "Role", value: data.role || "Not specified" },
            { label: "Experience", value: data.experience || "Not specified" },
            { label: "Received", value: timestamp },
          ]),
          kitMarkdown(`## Their introduction\n\n${data.message || "No introduction provided."}`),
        ].join("\n"),
        footnote: "Sent automatically when someone applies through medicconnect.co/join.",
      });
    }

    // Check notification setting
    const settingKey = formType === "contact" ? "notify_contact"
      : formType === "creator_application" ? "notify_creator"
      : "notify_application";

    const { data: setting } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", settingKey)
      .single();

    const shouldNotify = setting?.value === true;

    // Add to the audience and, if enabled, email the team, in parallel
    const tasks: Promise<any>[] = [
      addToAudience(supabase, data.email, data.name, audienceGroupName, audienceSource),
    ];

    if (shouldNotify) {
      tasks.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Medic Connect <notifications@medicconnect.co>",
            to: [NOTIFICATION_EMAIL],
            subject,
            html: htmlContent,
            tags: emailTags("form-notification"),
          }),
        }).then(async (res) => {
          const emailData = await res.json();
          if (!res.ok) {
            console.error("Resend API error:", emailData);
            throw new Error(`Resend API error: ${JSON.stringify(emailData)}`);
          }
          console.log("Email notification sent successfully:", emailData);
          return emailData;
        })
      );
    } else {
      console.log(`Email notification skipped (${settingKey} is disabled)`);
    }

    await Promise.all(tasks);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending notification:", error);
    // Don't expose internal error details to clients
    return new Response(JSON.stringify({ success: false, error: "Failed to send notification" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(withOpsLog("send-form-notification", handler));
