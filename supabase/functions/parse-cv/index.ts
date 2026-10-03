// Read a candidate's CV in full and record what it says.
//
// Three rules govern this function:
//  1. Parsed is not verified. Scalar claims land in mu_parsed_fields with a
//     confidence score and status 'pending'. Nothing is copied onto the person
//     record until promotion runs, and promotion only fills blanks.
//  2. The model never decides a profession. It reports what the CV says; the
//     deterministic taxonomy in _shared/professions.ts does the mapping.
//  3. Never infer. If the CV does not state it, the field is null. Every value
//     carries a verbatim quote; without a quote the value is dropped.
//
// The full read (employment history, qualifications, certificates, capability)
// is stored as one immutable document on mu_cv_parses.extraction. Scalars keep
// the existing mu_parsed_fields path so promotion and the 0.85 confidence
// threshold work unchanged, and specialisms and languages still normalise onto
// mu_profile_facets, which matching reads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { PROFESSIONS, matchProfession } from "../_shared/professions.ts";
import { FACET_TYPES, sanitiseFacets, vocabularyPrompt } from "../_shared/match-taxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const BUCKET = "applications";
// Claude does the extraction.
const CLAUDE_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 16000;
// Only .docx is read as text locally. Anything longer than this is chunked and
// merged rather than cut. PDFs go up whole as a native document block.
const CHUNK_CHARS = 80_000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CV_RE = /\bcv\b|resume|curriculum/i;

/** Scalar fields that keep the existing mu_parsed_fields path. */
const FIELD_KEYS = [
  "profession_text",
  "current_position",
  "employer",
  "years_experience",
  "qualification",
  "licensing_body",
  "license_number",
  "license_expiry",
  "state",
  "lga",
  "languages",
  "specialisms",
  "clinical_skills",
  "education",
  "certifications",
  "availability",
] as const;

const scalar = (desc: string) => ({
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"], description: desc },
    confidence: { type: "number" },
    evidence: { type: ["string", "null"], description: "Verbatim quote from the CV" },
  },
  required: ["value", "confidence", "evidence"],
});

const listOf = (props: Record<string, unknown>, required: string[]) => ({
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...props,
      confidence: { type: "number" },
      evidence: { type: ["string", "null"] },
    },
    required: [...required, "confidence", "evidence"],
  },
});

const str = { type: ["string", "null"] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    identity: {
      type: "object",
      additionalProperties: false,
      properties: {
        full_name: scalar("Name as printed on the CV"),
        phones: { type: "array", items: { type: "string" } },
        emails: { type: "array", items: { type: "string" } },
        address: scalar("The candidate's home address or area of residence, exactly as printed"),
        state: scalar(
          "Nigerian state the candidate LIVES IN, taken from the home address only. Not a state of origin, not an employer's location, not a deployment or posting. One state only, null if the address does not name one.",
        ),
        lga: scalar(
          "Local government area of the SAME home address that gave the state. Null unless the address itself names it. Never take it from a job, a posting or a state of origin.",
        ),
        date_of_birth: scalar("ISO date YYYY-MM-DD, only if the CV states it"),
      },
      required: ["full_name", "phones", "emails", "address", "state", "lga", "date_of_birth"],
    },
    profession: {
      type: "object",
      additionalProperties: false,
      properties: {
        current_role_title: scalar("Job title of the most recent role"),
        profession_text: scalar("The candidate's own description of what they are"),
        years_experience_total: scalar("Whole number of years, only if stated or unambiguous from dates"),
        years_in_profession: scalar("Whole number of years in the profession they name"),
        currently_employed: scalar("yes or no, only if the CV makes it clear"),
      },
      required: [
        "current_role_title",
        "profession_text",
        "years_experience_total",
        "years_in_profession",
        "currently_employed",
      ],
    },
    employment: listOf(
      {
        employer: str,
        job_title: str,
        start_date: { ...str, description: "YYYY-MM or YYYY-MM-DD" },
        end_date: { ...str, description: "YYYY-MM or YYYY-MM-DD, null if still there" },
        is_current: { type: ["boolean", "null"] },
        employment_type: { ...str, description: "full time, part time, locum, volunteer, NYSC, internship" },
        city: str,
        duties: { ...str, description: "One line, in the CV's own words where possible" },
      },
      ["employer", "job_title", "start_date", "end_date", "is_current", "employment_type", "city", "duties"],
    ),
    qualifications: listOf(
      { award: str, institution: str, awarding_body: str, year: str, country: str },
      ["award", "institution", "awarding_body", "year", "country"],
    ),
    licensing: {
      type: "object",
      additionalProperties: false,
      properties: {
        licensing_body: scalar("e.g. NMCN, MDCN, MLSCN"),
        licence_number: scalar("Registration or licence number as printed"),
        issue_date: scalar("ISO date YYYY-MM-DD"),
        expiry_date: scalar("ISO date YYYY-MM-DD. Look everywhere: header, footer, licence block, scanned stamp"),
        registration_status: scalar("e.g. current, provisional, lapsed"),
      },
      required: ["licensing_body", "licence_number", "issue_date", "expiry_date", "registration_status"],
    },
    certifications: listOf(
      { name: str, issuer: str, issued_at: str, expires_at: str },
      ["name", "issuer", "issued_at", "expires_at"],
    ),
    capability: {
      type: "object",
      additionalProperties: false,
      properties: {
        specialisms: { type: "array", items: { type: "string" } },
        care_settings: { type: "array", items: { type: "string" } },
        patient_groups: { type: "array", items: { type: "string" } },
        equipment: { type: "array", items: { type: "string" } },
        clinical_skills: { type: "array", items: { type: "string" } },
        languages: listOf({ name: str, fluency: str }, ["name", "fluency"]),
        availability: scalar("Availability or notice period, only if the CV states it"),
      },
      required: [
        "specialisms",
        "care_settings",
        "patient_groups",
        "equipment",
        "clinical_skills",
        "languages",
        "availability",
      ],
    },
    not_found: {
      type: "array",
      items: { type: "string" },
      description: "Fields normally expected for this profession that this CV does not contain",
    },
    quality: {
      type: "object",
      additionalProperties: false,
      properties: {
        is_cv: { type: "boolean" },
        readable: { type: "boolean" },
        looks_like_scan: { type: "boolean" },
        text_recovered: { ...str, description: "all, most, some, or almost none" },
        note: str,
      },
      required: ["is_cv", "readable", "looks_like_scan", "text_recovered", "note"],
    },
    facets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          facet_type: { type: "string", enum: [...FACET_TYPES] },
          code: { type: "string" },
          confidence: { type: "number" },
          evidence: { type: ["string", "null"] },
        },
        required: ["facet_type", "code", "confidence", "evidence"],
      },
    },
  },
  required: [
    "identity",
    "profession",
    "employment",
    "qualifications",
    "licensing",
    "certifications",
    "capability",
    "not_found",
    "quality",
    "facets",
  ],
} as const;

const SYSTEM = `You read healthcare CVs from Nigeria and transcribe them in full. You are a transcriber, not an assessor.

Absolute rules:
- Report only what the document states. If it is not there, return null. Never infer.
- Do not guess a profession from an employer name. Do not derive years of experience from a graduation date. Do not invent an expiry date from an issue date.
- Every value carries a confidence from 0 to 1 and a short verbatim quote from the CV as evidence. If you cannot quote the source, return null instead of the value.
- confidence 1 means the CV states it explicitly and unambiguously. Below 0.6 means you are unsure.
- Dates: ISO where possible (YYYY-MM-DD, or YYYY-MM when only a month is given).

Read the WHOLE document. Do not summarise, do not stop at the first section.
- employment: every position the CV lists, most recent first, including NYSC, locum, internship and volunteer work.
- qualifications: every award, not only the highest.
- certifications: every certificate awarded by a body (BLS, ACLS, safeguarding, infection control, manual handling, and anything else), with its issuer and its expiry if the CV states one. A certification is a named award from a named issuer. Do NOT list a professional licence or registration here (for example "Registered Nurse (Valid Licence)") - that belongs in licensing. Do NOT list soft skills, personal qualities or duties (time management, teamwork, communication, ethics, data protection awareness) as certifications.
- licensing: extract the expiry date wherever it appears, including headers, footers, licence blocks and scanned stamps. If the CV only says something like "Registered Nurse, valid licence", set registration_status from it and leave the number and dates null.
- capability: specialisms, care settings, patient groups, named equipment or systems, and languages with fluency where stated.

Location, read carefully: state and lga must come from ONE home address. Nigerian CVs often print a state of origin and a separate work posting; neither is where the candidate lives. If you cannot tell where they live, return null for both rather than mixing two lines.

not_found: list the fields normally expected for this candidate's profession that this CV does not contain, so we can ask them directly.
quality: say honestly whether this is a CV at all, whether it is readable, whether it looks like a scan, and how much text you recovered.

facets: normalise the CV onto the controlled vocabulary below. Only return codes that appear in it, spelled exactly as written, each with a verbatim quote. Do not pad the list.
Controlled vocabulary:
${vocabularyPrompt()}

Known profession categories, for reference only, do not force a match: ${PROFESSIONS.join(", ")}.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Pull plain text out of a .docx (the models cannot read the format directly). */
async function docxText(bytes: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) return "";
  const xml = await file.async("string");
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split long text on paragraph boundaries. Nothing is ever discarded. */
function chunkText(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];
  const parts: string[] = [];
  let buf = "";
  for (const para of text.split(/\n{2,}/)) {
    if (buf.length + para.length > CHUNK_CHARS && buf) {
      parts.push(buf);
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + para;
  }
  if (buf) parts.push(buf);
  return parts;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function downloadDoc(url: string): Promise<{ buf: ArrayBuffer; ext: string } | null> {
  const path = url.includes("/storage/v1/object/")
    ? decodeURIComponent(url.split(`/${BUCKET}/`)[1] ?? "")
    : url.replace(/^https?:\/\/[^/]+\//, "").replace(new RegExp(`^${BUCKET}/`), "");
  const ext = (path.split(".").pop() || "").toLowerCase();

  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  // An empty or truncated object reaches the model as an empty document and is
  // rejected there, so stop it here and report it as an unreadable upload.
  if (buf.byteLength === 0) return null;
  if (ext === "pdf") {
    const head = new Uint8Array(buf.slice(0, 5));
    const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
    if (!isPdf) return null;
  }
  return { buf, ext };
}

type Scalar = { value: string | null; confidence: number; evidence: string | null };
type Extraction = Record<string, any>;
type ModelResult = { extraction?: Extraction; model?: string; error?: string; chunks?: number; chars?: number };

const USER_PROMPT =
  "Read this CV in full and transcribe it as JSON. Report only what it states, and quote the source for every value.";

/** Claude (Anthropic direct). Preferred: better at long, messy CVs and at refusing to guess. */
async function claudeCall(content: any[]): Promise<{ extraction?: Extraction; error?: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      tools: [{ name: "cv_read", description: "Record the CV exactly as written.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "cv_read" },
    }),
  });

  if (!res.ok) return { error: `Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}` };

  const body = await res.json();
  const block = (body?.content || []).find((b: any) => b?.type === "tool_use");
  if (!block?.input) return { error: "Claude returned no structured output" };
  return { extraction: block.input as Extraction };
}

/** Build the message content for one chunk of the document. */
function buildContent(doc: { buf: ArrayBuffer; ext: string }, filename: string, chunk: string | null, part: string) {
  const content: any[] = [{ type: "text", text: `${USER_PROMPT}${part}` }];
  if (chunk == null) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: toBase64(doc.buf) },
    });
  } else {
    content[0].text += `\n\nCV TEXT (${filename}):\n${chunk}`;
  }
  return content;
}

const isScalar = (v: any) => v && typeof v === "object" && "confidence" in v;

/** Merge chunk results: arrays concatenate, scalars keep the most confident answer. */
function mergeExtractions(parts: Extraction[]): Extraction {
  if (parts.length === 1) return parts[0];
  const out: Extraction = JSON.parse(JSON.stringify(parts[0] ?? {}));
  for (const next of parts.slice(1)) {
    for (const [key, val] of Object.entries(next ?? {})) {
      const cur = out[key];
      if (Array.isArray(val)) {
        out[key] = [...(Array.isArray(cur) ? cur : []), ...val];
      } else if (isScalar(val)) {
        if (!isScalar(cur) || (val.value != null && (cur.value == null || val.confidence > cur.confidence))) {
          out[key] = val;
        }
      } else if (val && typeof val === "object") {
        out[key] = mergeExtractions([cur ?? {}, val]);
      } else if (cur == null) {
        out[key] = val;
      }
    }
  }
  return out;
}

/** One document, one extraction. Retries a malformed response once, then fails loudly. */
async function readDocument(doc: { buf: ArrayBuffer; ext: string }, filename: string): Promise<ModelResult> {
  let chunks: (string | null)[];
  let chars = 0;

  if (doc.ext === "pdf") {
    chunks = [null]; // native document block, never truncated
  } else if (doc.ext === "docx" || doc.ext === "doc") {
    const text = await docxText(doc.buf);
    if (!text) return { error: "Could not read the document text" };
    chars = text.length;
    chunks = chunkText(text);
  } else {
    return { error: `Unsupported file type: .${doc.ext}` };
  }

  const useClaude = !!ANTHROPIC_API_KEY;
  const results: Extraction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const part = chunks.length > 1 ? ` This is part ${i + 1} of ${chunks.length} of one CV.` : "";
    const content = buildContent(doc, filename, chunks[i], part);

    let attempt = useClaude ? await claudeCall(content) : { error: "No Anthropic key configured" };
    // Retry once.
    if (attempt.error && useClaude) attempt = await claudeCall(content);
    if (attempt.error) {
      errors.push(attempt.error);
      continue;
    }
    (attempt.extraction as any).__model = CLAUDE_MODEL;
    results.push(attempt.extraction!);
  }

  if (!results.length) return { error: errors.join(" ; ").slice(0, 500) || "No output from the model" };

  const model = String(results[0].__model || CLAUDE_MODEL);
  const merged = mergeExtractions(results);
  delete merged.__model;
  return { extraction: merged, model, chunks: chunks.length, chars };
}

// ---------------------------------------------------------------------------
// Turning the extraction into claims
// ---------------------------------------------------------------------------

const clamp = (n: any) => Math.max(0, Math.min(1, Number(n) || 0));
const text = (v: any) => (v == null ? null : String(v).trim() || null);

/** A value only counts when the model could quote its source. */
function claim(s: any): Scalar | null {
  if (!isScalar(s)) return null;
  const value = text(s.value);
  const evidence = text(s.evidence);
  if (!value || !evidence) return null;
  return { value, confidence: clamp(s.confidence), evidence: evidence.slice(0, 600) };
}

/** Months between two loose dates, for the gap flag. */
function monthsBetween(a: string, b: string): number | null {
  const parse = (d: string) => {
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(d.trim());
    return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
  };
  const x = parse(a);
  const y = parse(b);
  return x == null || y == null ? null : y - x;
}

/** Gaps are arithmetic, not judgement, so the code computes them, not the model. */
function employmentGaps(employment: any[]): any[] {
  const dated = employment
    .filter((e) => e?.start_date)
    .map((e) => ({ ...e, _start: String(e.start_date), _end: e.is_current ? null : text(e.end_date) }))
    .sort((a, b) => (a._start < b._start ? -1 : 1));

  const gaps: any[] = [];
  for (let i = 1; i < dated.length; i++) {
    const prevEnd = dated[i - 1]._end;
    if (!prevEnd) continue;
    const months = monthsBetween(prevEnd, dated[i]._start);
    if (months != null && months > 6) {
      gaps.push({
        from: prevEnd,
        to: dated[i]._start,
        months,
        after: dated[i - 1].employer ?? null,
        before: dated[i].employer ?? null,
      });
    }
  }
  return gaps;
}

const joinList = (arr: any): string | null => {
  if (!Array.isArray(arr)) return null;
  const vals = arr.map((v) => text(typeof v === "string" ? v : v?.name)).filter(Boolean);
  return vals.length ? Array.from(new Set(vals)).join(", ") : null;
};

/**
 * Things that are not certificates. A licence is a licence and belongs in the
 * licensing block; a personal quality is not an award from anybody.
 */
const CERT_NOISE =
  /(licen[cs]e|licensed|registered\s+(nurse|midwife|nurse\/midwife)|registration\s+(with|number)|practising|practicing)\b|^(time management|team ?work|communication|leadership|interpersonal|problem solving|critical thinking|ethics|integrity|punctuality|hard ?working|computer literacy|attention to detail)/i;

/** Map the full extraction onto the scalar fields mu_parsed_fields already knows. */
function scalarClaims(x: Extraction): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  const put = (key: string, s: Scalar | null) => {
    if (s) out[key] = s;
  };

  const id = x.identity ?? {};
  const prof = x.profession ?? {};
  const lic = x.licensing ?? {};
  const cap = x.capability ?? {};
  const employment: any[] = Array.isArray(x.employment) ? x.employment : [];
  const quals: any[] = Array.isArray(x.qualifications) ? x.qualifications : [];
  const certs: any[] = Array.isArray(x.certifications) ? x.certifications : [];

  put("profession_text", claim(prof.profession_text));
  put("current_position", claim(prof.current_role_title));
  put("years_experience", claim(prof.years_experience_total));
  put("state", claim(id.state));
  put("lga", claim(id.lga));
  put("licensing_body", claim(lic.licensing_body));
  put("license_number", claim(lic.licence_number));
  put("license_expiry", claim(lic.expiry_date));
  put("availability", claim(cap.availability));

  // Most recent employer, from the history rather than a separate question.
  const latest = employment.find((e) => e?.is_current) ?? employment[0];
  if (latest?.employer && latest?.evidence) {
    put("employer", {
      value: String(latest.employer).trim(),
      confidence: clamp(latest.confidence),
      evidence: String(latest.evidence).slice(0, 600),
    });
  }

  const topQual = quals[0];
  if (topQual?.award && topQual?.evidence) {
    const label = [topQual.award, topQual.institution].filter(Boolean).join(", ");
    put("qualification", {
      value: label,
      confidence: clamp(topQual.confidence),
      evidence: String(topQual.evidence).slice(0, 600),
    });
    put("education", {
      value: [label, topQual.year].filter(Boolean).join(" "),
      confidence: clamp(topQual.confidence),
      evidence: String(topQual.evidence).slice(0, 600),
    });
  }

  // A certification is an award from a body. Two kinds of noise kept ending up
  // here: the professional licence itself ("Registered Nurse (Valid Licence)"),
  // which belongs in licensing, and soft skills lifted off a bullet list.
  const certNames = certs.map((c) => text(c?.name)).filter(Boolean).filter((n) => !CERT_NOISE.test(n!));
  if (certNames.length) {
    put("certifications", {
      value: Array.from(new Set(certNames)).join(", "),
      confidence: clamp(certs[0]?.confidence ?? 0.8),
      evidence: text(certs[0]?.evidence)?.slice(0, 600) ?? null,
    });
  }

  const specialisms = joinList(cap.specialisms);
  if (specialisms) put("specialisms", { value: specialisms, confidence: 0.8, evidence: specialisms.slice(0, 600) });
  const skills = joinList(cap.clinical_skills);
  if (skills) put("clinical_skills", { value: skills, confidence: 0.8, evidence: skills.slice(0, 600) });
  const langs = Array.isArray(cap.languages)
    ? cap.languages
        .map((l: any) => [text(l?.name), text(l?.fluency)].filter(Boolean).join(" (") + (l?.fluency ? ")" : ""))
        .filter((v: string) => v && v !== "(")
    : [];
  if (langs.length) {
    put("languages", {
      value: Array.from(new Set(langs)).join(", "),
      confidence: clamp(cap.languages?.[0]?.confidence ?? 0.9),
      evidence: text(cap.languages?.[0]?.evidence)?.slice(0, 600) ?? langs.join(", ").slice(0, 600),
    });
  }

  return out;
}

async function parsePerson(personId: string, dryRun = false) {
  const { data: person } = await admin.from("mu_people").select("*").eq("id", personId).maybeSingle();
  if (!person) return { person_id: personId, status: "error", message: "Person not found" };

  const { data: docs } = await admin
    .from("mu_documents")
    .select("id, label, url, created_at")
    .eq("person_id", personId)
    .order("created_at", { ascending: false });

  const cv = (docs || []).find((d: any) => CV_RE.test(`${d.label} ${d.url}`));
  if (!cv) {
    if (!dryRun) {
      await admin
        .from("mu_people")
        .update({ parse_status: "no_cv", parsed_at: new Date().toISOString() })
        .eq("id", personId);
    }
    return { person_id: personId, status: "no_cv", message: "No CV on file" };
  }

  const doc = await downloadDoc(cv.url);
  if (!doc) {
    if (!dryRun) {
      await admin
        .from("mu_people")
        .update({ parse_status: "failed", parsed_at: new Date().toISOString() })
        .eq("id", personId);
    }
    return { person_id: personId, status: "failed", message: "Could not read the CV file. It may be empty or damaged, so ask for it again." };
  }

  const result = await readDocument(doc, cv.label || "cv");
  if (result.error || !result.extraction) {
    if (!dryRun) {
      await admin
        .from("mu_people")
        .update({ parse_status: "failed", parsed_at: new Date().toISOString() })
        .eq("id", personId);
      // Fail loudly: the reason is recorded, not swallowed.
      await admin.from("mu_cv_parses").insert({
        person_id: personId,
        document_id: cv.id,
        document_label: cv.label,
        model: CLAUDE_MODEL,
        fields: {},
        extraction: {},
        error: result.error ?? "Unknown parse failure",
        gaps: [],
      });
    }
    return { person_id: personId, status: "failed", message: result.error };
  }

  const x = result.extraction;
  const usedModel = result.model ?? CLAUDE_MODEL;
  const employment: any[] = Array.isArray(x.employment) ? x.employment : [];
  x.employment_gaps = employmentGaps(employment);

  const claims = scalarClaims(x);
  const notFound: string[] = Array.isArray(x.not_found) ? x.not_found.map(String) : [];

  // An area has to sit inside the state above it. Michika is in Adamawa, so a
  // read of "Lagos" with "Michika" under it is two different lines of the CV,
  // not one address. Keep neither: ask the candidate instead.
  if (claims.state?.value && claims.lga?.value) {
    const { data: known } = await admin
      .from("mu_lga_index")
      .select("state")
      .ilike("lga", String(claims.lga.value).replace(/\s*(lga|local government( area)?)\s*$/i, "").trim());
    const states = (known || []).map((r: any) => String(r.state).toLowerCase());
    const stated = String(claims.state.value).toLowerCase();
    if (states.length && !states.some((s) => stated.includes(s) || s.includes(stated))) {
      delete claims.lga;
      delete claims.state;
      if (!notFound.includes("state")) notFound.push("state");
      if (!notFound.includes("lga")) notFound.push("lga");
    }
  }
  const quality = x.quality ?? {};

  if (dryRun) {
    return {
      person_id: personId,
      status: "dry_run",
      model: usedModel,
      chunks: result.chunks,
      text_chars: result.chars,
      claims: Object.keys(claims).length,
      extraction: x,
    };
  }

  // Never touch a claim an admin has already ruled on or settled, and a value
  // the candidate gave is never overwritten by a later parse.
  const { data: settled } = await admin
    .from("mu_parsed_fields")
    .select("field, status")
    .eq("person_id", personId)
    .in("status", ["accepted", "rejected", "candidate_updated", "superseded"]);
  const locked = new Set((settled || []).map((r: any) => r.field));

  const rows: any[] = [];
  for (const key of FIELD_KEYS) {
    const c = claims[key];
    if (!c || locked.has(key)) continue;
    rows.push({
      person_id: personId,
      document_id: cv.id,
      field: key,
      value: c.value,
      confidence: c.confidence,
      evidence: c.evidence,
      model: usedModel,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    });
  }

  // Deterministic profession: the model reported text, the taxonomy maps it.
  const professionText = claims.profession_text?.value ?? null;
  const mapped = matchProfession(professionText) || matchProfession(person.current_position);
  if (mapped && !locked.has("profession")) {
    rows.push({
      person_id: personId,
      document_id: cv.id,
      field: "profession",
      value: mapped,
      confidence: matchProfession(person.current_position) === mapped ? 0.95 : 0.75,
      evidence: professionText ? `Mapped from "${professionText}"` : `Mapped from stated role "${person.current_position}"`,
      model: "taxonomy",
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    });
  }

  if (rows.length) {
    await admin.from("mu_parsed_fields").upsert(rows, { onConflict: "person_id,field" });
  }

  // Normalised facets. Anything outside the controlled vocabulary is dropped,
  // and a facet the candidate confirmed or an admin verified is never demoted.
  const clean = sanitiseFacets(x.facets);
  let facetCount = 0;
  if (clean.length) {
    const { data: settledFacets } = await admin
      .from("mu_profile_facets")
      .select("facet_type, code")
      .eq("person_id", personId)
      .in("source", ["claimed", "verified"]);
    const lockedFacets = new Set((settledFacets || []).map((r: any) => `${r.facet_type}:${r.code}`));

    const rawFacets: any[] = Array.isArray(x.facets) ? x.facets : [];
    const facetRows = clean
      .filter((f) => !lockedFacets.has(`${f.facet_type}:${f.code}`))
      .map((f) => {
        const src = rawFacets.find(
          (r: any) => r?.facet_type === f.facet_type && String(r?.code || "").toLowerCase() === f.code,
        );
        return {
          person_id: personId,
          facet_type: f.facet_type,
          code: f.code,
          source: "parsed",
          confidence: clamp(src?.confidence ?? 0.5),
          evidence: src?.evidence ? String(src.evidence).slice(0, 600) : null,
          document_id: cv.id,
          model: usedModel,
        };
      });

    if (facetRows.length) {
      await admin.from("mu_profile_facets").upsert(facetRows, { onConflict: "person_id,facet_type,code" });
      facetCount = facetRows.length;
    }
  }

  // A licence expiry read off the CV becomes an unverified claim on the credential
  // ladder, so the nightly expiry sweep has a date to chase. It never counts as
  // evidence and it never overwrites a verified record.
  const expiry = claims.license_expiry?.value ?? null;
  if (expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    const { data: cred } = await admin
      .from("mu_credentials")
      .select("id, verified_at, expires_at")
      .eq("person_id", personId)
      .eq("credential_type", "licence")
      .maybeSingle();
    if (!cred) {
      await admin.from("mu_credentials").insert({
        person_id: personId,
        credential_type: "licence",
        claim: "yes",
        claim_source: "cv_parsed",
        claim_at: new Date().toISOString(),
        expires_at: expiry,
        reference: claims.license_number?.value ?? null,
        note: "Read from the CV, not yet verified",
      });
    } else if (!cred.verified_at && !cred.expires_at) {
      await admin.from("mu_credentials").update({ expires_at: expiry }).eq("id", cred.id);
    }
  }

  // What THIS CV failed to yield. Kept as parse history only. candidate_gaps on
  // mu_people is DERIVED in the database from every source at once, so the
  // parser must never write it.
  const gaps: string[] = [];
  if (!mapped) gaps.push("profession");
  const has = (k: string) => rows.some((r) => r.field === k) || (person as any)[k] != null;
  ["years_experience", "state", "lga", "licensing_body", "license_number", "license_expiry"].forEach((k) => {
    if (!has(k)) gaps.push(k);
  });

  await admin
    .from("mu_people")
    .update({
      parse_status: rows.length ? "parsed" : "empty",
      parsed_at: new Date().toISOString(),
    })
    .eq("id", personId);

  // Historical record of this parse, kept even when later CVs supersede it.
  await admin.from("mu_cv_parses").insert({
    person_id: personId,
    document_id: cv.id,
    document_label: cv.label,
    model: usedModel,
    fields: claims,
    extraction: x,
    quality,
    not_found: notFound,
    chunks: result.chunks ?? 1,
    text_chars: result.chars ?? null,
    profession: mapped,
    gaps,
  });

  await admin.from("mu_activity").insert({
    person_id: personId,
    action: "cv_parsed",
    detail: {
      document: cv.label,
      claims: rows.length,
      facets: facetCount,
      roles: employment.length,
      qualifications: Array.isArray(x.qualifications) ? x.qualifications.length : 0,
      certifications: Array.isArray(x.certifications) ? x.certifications.length : 0,
      licence_expiry: expiry,
      gaps,
      model: usedModel,
    },
    actor_name: "CV parser",
  });

  return {
    person_id: personId,
    status: "parsed",
    claims: rows.length,
    facets: facetCount,
    roles: employment.length,
    qualifications: Array.isArray(x.qualifications) ? x.qualifications.length : 0,
    certifications: Array.isArray(x.certifications) ? x.certifications.length : 0,
    licence_expiry: expiry,
    employment_gaps: x.employment_gaps.length,
    not_found: notFound,
    gaps,
    profession: mapped,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Two callers: an admin in the console, or the scheduled sweeper (shared secret).
    const cronSecret = Deno.env.get("PARSE_CV_CRON_SECRET") ?? "";
    const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) return json({ error: "Unauthorised" }, 401);

      const caller = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await caller.auth.getUser();
      const user = userData?.user;
      if (!user) return json({ error: "Unauthorised" }, 401);

      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles || []).some((r: any) => r.role === "admin")) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    let ids: string[] = Array.isArray(body.person_ids)
      ? body.person_ids
      : body.person_id
        ? [body.person_id]
        : [];

    // No explicit ids: take the next unparsed people who have a document on file.
    if (!ids.length) {
      const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 25);
      const { data: queue } = await admin
        .from("mu_people")
        .select("id, mu_documents!inner(id)")
        .in("parse_status", ["queued", "not_parsed"])
        .order("last_activity_at", { ascending: false })
        .limit(limit);
      ids = (queue || []).map((r: any) => r.id);
      if (!ids.length) return json({ results: [], done: true });
    }

    const clean = ids.filter((v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 25);
    if (!clean.length) return json({ error: "Provide person_id or person_ids" }, 400);

    const results: any[] = new Array(clean.length);
    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async () => {
      while (cursor < clean.length) {
        const i = cursor++;
        const id = clean[i];
        try {
          results[i] = await parsePerson(id, dryRun);
        } catch (e) {
          if (!dryRun) {
            await admin
              .from("mu_people")
              .update({ parse_status: "failed", parsed_at: new Date().toISOString() })
              .eq("id", id);
          }
          results[i] = { person_id: id, status: "failed", message: String((e as Error).message).slice(0, 300) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, clean.length) }, worker));

    return json({ results });
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 300) }, 500);
  }
});
