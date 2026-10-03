import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, guard, ok } from "../result";

type Row = {
  person_id: string;
  full_name: string;
  profession: string | null;
  years_experience: number | null;
  state: string | null;
  lga: string | null;
  score: number;
  breakdown: Record<string, any>;
  blockers: string[];
  matched_required: string[];
  matched_desirable: string[];
  missing_required: string[];
};

const provenance = (source: string | undefined) =>
  source === "admin_verified"
    ? "admin verified"
    : source === "parsed" || source === "cv_parsed"
      ? "parsed from CV, unverified"
      : "self declared by the candidate";

const TIER_MEANING: Record<string, string> = {
  unknown: "never claimed and no document held",
  declined: "the candidate said they do not hold it",
  self_declared: "ticked yes on a form, no document, nobody has checked it",
  documented: "a document is on file, awaiting admin review",
  verified: "an admin reviewed the document and passed it",
  expired: "passed review once but has since lapsed",
  rejected: "an admin reviewed the document and failed it",
};

// The credential tier as it arrives from the matcher: an object, never a bare
// string. Typing it this way is the fix — the old signature took `string`, a
// JSON object was passed in, and TypeScript's implicit any let it print as
// "[object Object]" twice in a row.
type CredentialCell = { state?: string | null; required_floor?: string | null };

const TIER_STATES = Object.keys(TIER_MEANING);

/** Narrow anything the matcher hands us down to a known tier string. */
const tierOf = (cell: CredentialCell | undefined): string => {
  const s = cell?.state;
  return typeof s === "string" && TIER_STATES.includes(s) ? s : "unknown";
};

// Display rule: a credential is never named without the tier that earned it,
// and never without the tier this brief actually asks for.
function credentialPhrase(label: string, cell: CredentialCell | undefined): string {
  const state = tierOf(cell);
  const floor = typeof cell?.required_floor === "string" ? cell.required_floor : null;
  const asked = floor && floor !== "none" ? `, this brief asks for ${floor}` : "";
  return `${label}: ${state} (${TIER_MEANING[state]}${asked})`;
}

function reasonFor(r: Row): string {
  const b = r.breakdown ?? {};
  const cred = (b.credentials ?? {}) as Record<string, CredentialCell>;
  const parts: string[] = [
    `Profession ${r.profession ?? "unknown"} (${provenance(b.profession_source)})`,
    `Location ${[r.lga, r.state].filter(Boolean).join(", ") || "unknown"} (${provenance(b.state_source)})`,
    `${b.required_matched ?? 0}/${b.required_total ?? 0} required and ${b.desirable_matched ?? 0}/${b.desirable_total ?? 0} desirable clinical requirements matched`,
    `${b.verified_facets ?? 0} matched facets are admin verified, the rest are parsed from a CV and unverified`,
    `${r.years_experience ?? "unknown"} years experience (self declared on the application form)`,
    credentialPhrase("Licence", cred.licence),
    credentialPhrase("Right to work", cred.right_to_work),
    `Profile completeness ${b.profile_completeness ?? b.completeness ?? 0}% (fields filled in), deployment readiness ${b.deployment_readiness ?? 0}% (credentials backed by a reviewed document)`,
  ];
  if (r.missing_required?.length) parts.push(`Missing required clinical facets: ${r.missing_required.join(", ")}`);
  if (r.blockers?.length) parts.push(`Blockers: ${r.blockers.join("; ")}`);
  return parts.join(". ") + ".";
}


export default defineTool({
  name: "match_candidates",
  title: "Rank candidates for an opportunity",
  description:
    "Run the deterministic SQL matcher for an opportunity and return ranked candidates with score, weighted breakdown, blockers, matched/missing requirements and a reason string naming which matched fields are parsed-unverified versus confirmed. Refuses to rank when the opportunity has no criteria: returns unrankable=true naming the missing criteria rather than a plausible-looking shortlist. Ranking is computed in the database, never by the model.",
  inputSchema: {
    opportunity_id: z.string().uuid().describe("Opportunity id to rank candidates against."),
    limit: z.number().int().min(1).max(50).optional().describe("Max candidates (default 20, hard max 50)."),
    include_blocked: z
      .boolean()
      .optional()
      .describe("Include candidates who fail a hard filter, with their blockers listed (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ opportunity_id, limit, include_blocked }, ctx) =>
    guard("match_candidates", async () => {
      if (!ctx.isAuthenticated()) return fail("Not authenticated");
      const db = supabaseForUser(ctx);

      // Declare the criteria up front so an empty brief can never masquerade
      // as a ranked shortlist.
      const { data: opp, error: oppError } = await db
        .from("matchmaker_opportunities")
        .select(
          "id,title,status,location,match_professions,match_states,match_lgas,match_min_years,match_requires_licence,match_requires_right_to_work,min_licence_evidence,min_right_to_work_evidence,requirements_parsed_at",
        )
        .eq("id", opportunity_id)
        .maybeSingle();
      if (oppError) return fail("Database error", oppError.message);
      if (!opp) return fail("Opportunity not found");

      // One quantity, four names, was the bug. There are exactly two things
      // being counted: what the BRIEF asks for (requirement_facets, below) and
      // what a CANDIDATE matched (breakdown.required_matched/required_total).
      // Clinical facet types mirror the matcher: skill, specialty, setting.
      const { data: facetRows } = await db
        .from("matchmaker_opportunity_facets")
        .select("facet_type, requirement")
        .eq("opportunity_id", opportunity_id);

      const facets = facetRows ?? [];
      const isClinical = (t: string) => ["skill", "specialty", "setting"].includes(t);
      const requirement_facets = {
        clinical_required: facets.filter((f) => isClinical(f.facet_type) && f.requirement === "required").length,
        clinical_desirable: facets.filter((f) => isClinical(f.facet_type) && f.requirement === "desirable").length,
        preference: facets.filter((f) => !isClinical(f.facet_type)).length,
        total: facets.length,
        note: "total = clinical_required + clinical_desirable + preference. Only clinical_required is counted in a candidate's breakdown.required_total; seniority and availability are preferences and are scored but never required.",
      };
      const facetCount = facets.length;

      const missing: string[] = [];
      if (!(opp.match_professions ?? []).length) missing.push("match_professions");
      if (!(opp.match_states ?? []).length && !(opp.match_lgas ?? []).length)
        missing.push("match_states / match_lgas");
      if (opp.match_min_years === null || opp.match_min_years === undefined) missing.push("match_min_years");
      if (!facetCount) missing.push("requirement facets");


      const hasNoCriteria =
        !(opp.match_professions ?? []).length &&
        !(opp.match_states ?? []).length &&
        !(opp.match_lgas ?? []).length &&
        (opp.match_min_years === null || opp.match_min_years === undefined) &&
        !opp.match_requires_licence &&
        !opp.match_requires_right_to_work &&
        !facetCount;

      if (hasNoCriteria) {
        return ok({
          unrankable: true,
          opportunity: { id: opp.id, title: opp.title, location: opp.location },
          missing_criteria: missing,
          message:
            "This opportunity has no match criteria, so no ranking is returned. Any shortlist produced now would rank on years of experience, document count and recency alone and would ignore profession and location. Set criteria first (parse the brief in the admin Matches workspace, or call set_opportunity_criteria).",
        });
      }

      const { data, error } = await db.rpc("mu_match_report", {
        _opportunity_id: opportunity_id,
        _limit: Math.min(limit ?? 20, 50),
      });
      if (error) {
        if (String(error.message).toUpperCase().includes("UNRANKABLE")) {
          return ok({ unrankable: true, missing_criteria: missing, message: error.message });
        }
        return fail("Matcher error", error.message);
      }

      const report = (data ?? {}) as {
        pool_size: number;
        considered: number;
        passed: number;
        required_facets: number;
        best_required_coverage: number;
        exclusion_reasons: Record<string, number>;
        candidates: Row[];
      };

      let rows = (report.candidates ?? []).map((r) => ({ ...r, reason: reasonFor(r) }));

      if (include_blocked) {
        const { data: blocked } = await db.rpc("mu_match_candidates", {
          _opportunity_id: opportunity_id,
          _limit: Math.min(limit ?? 20, 50),
          _include_blocked: true,
        });
        rows = ((blocked ?? []) as Row[]).map((r) => ({ ...r, reason: reasonFor(r) }));
      }

      const criteria_used = {
        professions: opp.match_professions ?? [],
        states: opp.match_states ?? [],
        lgas: opp.match_lgas ?? [],
        min_years: opp.match_min_years,
        min_licence_evidence: (opp as any).min_licence_evidence ?? "none",
        min_right_to_work_evidence: (opp as any).min_right_to_work_evidence ?? "none",
        partial_criteria: missing.length ? missing : null,
      };

      const diagnostics = {
        pool_size: report.pool_size,
        considered: report.considered,
        passed_hard_filters: report.passed,
        best_required_coverage: report.best_required_coverage,
        excluded_by: report.exclusion_reasons ?? {},
      };


      // An empty shortlist is never returned bare: say which filter emptied it.
      if (!report.passed) {
        const worst = Object.entries(report.exclusion_reasons ?? {}).sort((a, b) => b[1] - a[1]);
        return ok({
          no_matches: true,
          candidates: [],
          criteria_used,
          requirement_facets,
          diagnostics,

          message:
            `No candidate clears the hard filters for this opportunity. ${report.considered} profiles were considered. ` +
            (worst.length
              ? `Largest exclusion: ${worst[0][0]} (${worst[0][1]} candidates). Full breakdown in diagnostics.excluded_by. `
              : "") +
            "Relax or correct a hard filter (profession list, state, minimum years, or the credential evidence tier) and rank again. " +
            "If the licence tier is 'documented' or 'verified', nobody holds evidence at that tier yet: lower it to 'self_declared' or work the verification queue first.",
        });
      }

      return ok({
        candidates: rows,
        criteria_used,
        requirement_facets,
        diagnostics,

        credential_tiers: {
          ladder: ["unknown", "declined", "self_declared", "documented", "verified"],
          meaning: TIER_MEANING,
          rule: "Never present a credential without its tier. self_declared means a tick on a form and nothing more; we cannot check the Nursing and Midwifery Council register, so 'verified' means an admin reviewed an uploaded document.",
        },
        limitations: [
          "Ranking is deterministic SQL. The model contributes vocabulary only, never selection or order.",
          "breakdown.credentials gives the derived tier per credential. A licence that reads self_declared has no document behind it.",
          "profile_completeness is fields filled in. deployment_readiness is credentials backed by a reviewed document. They are different numbers and only the second one means anyone checked anything.",
          "Most profile facets are parsed from CVs and are NOT verified. Check verified_facets before presenting anyone to a client.",
          "Seniority and availability are preferences, not clinical requirements: they are scored but never counted in required_total or missing_required.",
          "There is no availability calendar, so nobody here has been filtered on whether they are actually free.",
        ],
      });

    }),
});

