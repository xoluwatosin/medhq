import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBlogPostsTool from "./tools/list_blog_posts";
import createBlogDraftTool from "./tools/create_blog_draft";
import listCampaignsTool from "./tools/list_campaigns";
import listEnquiriesTool from "./tools/list_enquiries";
import searchHeroesTool from "./tools/search_heroes";
import getHeroProfileTool from "./tools/get_hero_profile";
import listOpportunitiesTool from "./tools/list_opportunities";
import getOpportunityTool from "./tools/get_opportunity";
import createOpportunityTool from "./tools/create_opportunity";
import matchCandidatesTool from "./tools/match_candidates";
import matchOpportunitiesForPersonTool from "./tools/match_opportunities_for_person";
import setOpportunityCriteriaTool from "./tools/set_opportunity_criteria";
import shortlistCandidateTool from "./tools/shortlist_candidate";
import addAdminNoteTool from "./tools/add_admin_note";
import verificationQueueTool from "./tools/verification_queue";
import dbTablesTool from "./tools/db_tables";
import dbSelectTool from "./tools/db_select";
import storageBrowseTool from "./tools/storage_browse";

// The OAuth issuer MUST be the direct Supabase host — see app-mcp-server-authoring.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "medic-connect-care",
  title: "MEDIC CONNECT CARE",
  version: "0.11.0",
  instructions:
    "Tools for the Medic Connect admin platform, including the Match Universe talent pool. Content: `list_blog_posts`, `create_blog_draft`, `list_campaigns`, `list_enquiries`. Talent pool: `search_heroes`, `get_hero_profile`, `list_opportunities`, `get_opportunity`, `create_opportunity` (draft only), `match_candidates` (refuses to rank an opportunity with no criteria, returning unrankable=true, and returns no_matches=true with an exclusion breakdown when criteria exist but every candidate is filtered out; credentials are an evidence ladder: unknown, declined, self_declared, documented, verified, expired, rejected, and an opportunity sets a minimum tier rather than a boolean), `set_opportunity_criteria`, `match_opportunities_for_person`, `shortlist_candidate`, `add_admin_note`, `verification_queue` (documents waiting on review, ranked by shortlist pressure). Facet counts come in exactly two quantities: `requirement_facets` (what the brief asks for: clinical_required, clinical_desirable, preference, total) and each candidate's `breakdown.required_matched` / `required_total` (what that person matched, counted only against clinical required facets). Ranking is always computed by the deterministic SQL matcher, never by the model - use `match_candidates` rather than eyeballing profiles. Parsed CV data is not verified data; say so when summarising. Never state a credential without its tier: self_declared means the candidate ticked yes on a form with no document and no check, and no external register is ever consulted. profile_completeness (fields filled in) and deployment_readiness (credentials backed by a reviewed document) are different numbers; quote both. No tool here messages a candidate, changes verification state, publishes content or confirms a deployment - those stay in the admin UI. Availability is a real calendar now, resolved per opportunity window into exactly three states: available (the candidate said they are free), unavailable (the candidate said they are booked) and unknown (the candidate said nothing). Unknown never excludes anyone and must never be reported as a no - report it as 'not stated'. A candidate is only ruled out on availability when the brief sets min_availability_evidence='available' and the calendar positively says unavailable. Always quote calendar freshness (updated_within_14_days / last_update) beside any availability claim: a two-month-old calendar is not evidence. Result sizes are capped; never assume a full pool dump. All calls run under the signed-in admin's RLS scope. This server is READ-ONLY over the general backend: `db_tables` (discover tables and row counts) and `db_select` (read any table with filters, embeds and paging) exist for questions the purpose-built tools cannot answer. There is no generic insert, update, delete or function-call tool: every write goes through a named tool with its own rules (`create_blog_draft`, `create_opportunity`, `set_opportunity_criteria`, `shortlist_candidate`, `add_admin_note`) or through the admin UI. Verification state can only be changed by an admin in the UI. `storage_browse` lists file names only; opening a candidate document requires sign=true plus the exact file name and a written reason, and issues a single one-hour link.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    // Given explicitly so the isolate skips the OAuth discovery round trip and
    // fetches the key set directly: one outbound request on cold start, not two.
    jwksUri: `https://${projectRef}.supabase.co/auth/v1/.well-known/jwks.json`,
    acceptedAudiences: "authenticated",
  }),

  tools: [
    listBlogPostsTool,
    createBlogDraftTool,
    listCampaignsTool,
    listEnquiriesTool,
    searchHeroesTool,
    getHeroProfileTool,
    listOpportunitiesTool,
    getOpportunityTool,
    createOpportunityTool,
    matchCandidatesTool,
    matchOpportunitiesForPersonTool,
    setOpportunityCriteriaTool,
    shortlistCandidateTool,
    addAdminNoteTool,
    verificationQueueTool,
    dbTablesTool,
    dbSelectTool,
    storageBrowseTool,
  ],

});
