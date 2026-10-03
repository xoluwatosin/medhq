// Read a non-CV document and record what it says.
//
// The same three rules as the CV parser apply, and one more:
//  1. Parsed is not verified. Everything lands as a claim with a confidence and
//     a verbatim quote. Only an admin turns a claim into evidence.
//  2. The model never decides. It reports the text it can see; the reference
//     corpus (licensing bodies, awards, training catalogue, lexicon) does the
//     mapping onto codes we match on.
//  3. Never infer. No quote, no value.
//  4. Content decides the document kind. The filename is only a first guess and
//     is overwritten the moment the file is actually read.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { sanitiseFacets } from "../_shared/match-taxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const BUCKET = "applications";
const CLAUDE_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8000;
const CHUNK_CHARS = 60_000;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------------------------------------------------------------------------
// Schema: one shape covering every kind of document, with a kind field on top.
// ---------------------------------------------------------------------------

const str = { type: ["string", "null"] };

const scalar = (desc: string) => ({
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"], description: desc },
    confidence: { type: "number" },
    evidence: { type: ["string", "null"], description: "Verbatim text from the document" },
  },
  required: ["value", "confidence", "evidence"],
});

const DOC_KINDS = [
  "cv",
  "practising_licence",
  "registration_certificate",
  "qualification_certificate",
  "training_certificate",
  "nysc",
  "government_id",
  "right_to_work",
  "reference_letter",
  "service_letter",
  "police_clearance",
  "medical_fitness",
  "proof_of_address",
  "other",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    classification: {
      type: "object",
      additionalProperties: false,
      properties: {
        doc_kind: { type: "string", enum: DOC_KINDS },
        confidence: { type: "number" },
        evidence: { type: ["string", "null"], description: "The heading or wording that decided it" },
        issuer_text: { ...str, description: "The organisation that issued the document, as printed" },
        title_text: { ...str, description: "The document's own title, as printed" },
      },
      required: ["doc_kind", "confidence", "evidence", "issuer_text", "title_text"],
    },
    holder: {
      type: "object",
      additionalProperties: false,
      properties: {
        full_name: scalar("Name of the person the document belongs to"),
        date_of_birth: scalar("ISO date YYYY-MM-DD"),
        sex: scalar("male or female, only if printed"),
        address: scalar("Address as printed"),
        state: scalar("Nigerian state of the printed address only"),
        lga: scalar("Local government area of the same printed address"),
      },
      required: ["full_name", "date_of_birth", "sex", "address", "state", "lga"],
    },
    credential: {
      type: "object",
      additionalProperties: false,
      properties: {
        licensing_body_text: scalar("Council or board named on the document, as printed"),
        registration_number: scalar("Registration or licence number as printed"),
        profession_text: scalar("The profession or cadre the document names"),
        issue_date: scalar("ISO date YYYY-MM-DD"),
        expiry_date: scalar("ISO date YYYY-MM-DD. Look at stamps, footers and renewal blocks"),
        status_text: scalar("e.g. current, provisional, lapsed"),
      },
      required: [
        "licensing_body_text",
        "registration_number",
        "profession_text",
        "issue_date",
        "expiry_date",
        "status_text",
      ],
    },
    qualification: {
      type: "object",
      additionalProperties: false,
      properties: {
        award_text: scalar("Award as printed, e.g. Bachelor of Nursing Science"),
        institution_text: scalar("Institution as printed"),
        award_date: scalar("ISO date YYYY-MM-DD or YYYY"),
        grade: scalar("Class or grade, only if printed"),
      },
      required: ["award_text", "institution_text", "award_date", "grade"],
    },
    training: {
      type: "object",
      additionalProperties: false,
      properties: {
        course_text: scalar("Course title as printed, e.g. Basic Life Support"),
        issuer_text: scalar("Awarding body as printed"),
        issue_date: scalar("ISO date YYYY-MM-DD"),
        expiry_date: scalar("ISO date YYYY-MM-DD, only if printed"),
        cpd_hours: scalar("Hours or credits, only if printed"),
      },
      required: ["course_text", "issuer_text", "issue_date", "expiry_date", "cpd_hours"],
    },
    identity_document: {
      type: "object",
      additionalProperties: false,
      properties: {
        id_type: scalar("NIN slip, international passport, voter card, driver licence"),
        id_number: scalar("Number in full, exactly as printed"),
        country: scalar("Issuing country"),
        expiry_date: scalar("ISO date YYYY-MM-DD"),
      },
      required: ["id_type", "id_number", "country", "expiry_date"],
    },
    right_to_work: {
      type: "object",
      additionalProperties: false,
      properties: {
        country: scalar("Country the permission applies to"),
        permit_type: scalar("Visa or permit type as printed"),
        permit_number: scalar("Number as printed"),
        valid_from: scalar("ISO date YYYY-MM-DD"),
        expiry_date: scalar("ISO date YYYY-MM-DD"),
        conditions: scalar("Any working restriction printed on it"),
      },
      required: ["country", "permit_type", "permit_number", "valid_from", "expiry_date", "conditions"],
    },
    nysc: {
      type: "object",
      additionalProperties: false,
      properties: {
        nysc_status: scalar("completed, exempted, exclusion, or serving, from the wording used"),
        service_state: scalar("State of primary assignment"),
        call_up_number: scalar("Call-up number as printed"),
        issue_date: scalar("ISO date YYYY-MM-DD"),
      },
      required: ["nysc_status", "service_state", "call_up_number", "issue_date"],
    },
    employment: {
      type: "object",
      additionalProperties: false,
      properties: {
        employer: scalar("Employer as printed"),
        job_title: scalar("Role as printed"),
        start_date: scalar("YYYY-MM-DD or YYYY-MM"),
        end_date: scalar("YYYY-MM-DD or YYYY-MM, null if still employed"),
        letter_type: scalar("appointment, confirmation, service, promotion, resignation"),
      },
      required: ["employer", "job_title", "start_date", "end_date", "letter_type"],
    },
    reference: {
      type: "object",
      additionalProperties: false,
      properties: {
        referee_name: scalar("Referee as printed"),
        referee_role: scalar("Their role"),
        organisation: scalar("Their organisation"),
        referee_contact: scalar("Phone or email printed on the letter"),
        relationship: scalar("How they know the candidate"),
        sentiment: scalar("positive, mixed or negative, from the wording"),
      },
      required: ["referee_name", "referee_role", "organisation", "referee_contact", "relationship", "sentiment"],
    },
    check: {
      type: "object",
      additionalProperties: false,
      properties: {
        issuing_authority: scalar("Authority that issued the check or report"),
        outcome: scalar("The printed result, e.g. no criminal record, fit for work"),
        issue_date: scalar("ISO date YYYY-MM-DD"),
        expiry_date: scalar("ISO date YYYY-MM-DD, only if printed"),
      },
      required: ["issuing_authority", "outcome", "issue_date", "expiry_date"],
    },
    phrases: {
      type: "array",
      description: "Skill, specialty, setting or patient-group phrases printed in the document, verbatim.",
      items: { type: "string" },
    },
    quality: {
      type: "object",
      additionalProperties: false,
      properties: {
        readable: { type: "boolean" },
        looks_like_scan: { type: "boolean" },
        text_recovered: { ...str, description: "all, most, some, or almost none" },
        belongs_to_holder: { type: ["boolean", "null"], description: "Does the printed name match the candidate?" },
        note: str,
      },
      required: ["readable", "looks_like_scan", "text_recovered", "belongs_to_holder", "note"],
    },
    not_found: {
      type: "array",
      items: { type: "string" },
      description: "Fields normally printed on this kind of document that this copy does not show",
    },
  },
  required: [
    "classification",
    "holder",
    "credential",
    "qualification",
    "training",
    "identity_document",
    "right_to_work",
    "nysc",
    "employment",
    "reference",
    "check",
    "phrases",
    "quality",
    "not_found",
  ],
} as const;

const systemPrompt = (candidateName: string, bodies: string[]) =>
  `You read healthcare documents from Nigeria and transcribe them. You are a transcriber, not an assessor.

Absolute rules:
- Report only what the document prints. If it is not there, return null. Never infer.
- Every value carries a confidence from 0 to 1 and a short verbatim quote as evidence. No quote, no value.
- Do not convert an issue date into an expiry date. Do not guess a council from a profession.
- Dates: ISO where possible (YYYY-MM-DD, or YYYY-MM when only a month is printed).
- Numbers: transcribe registration, licence and ID numbers in full, exactly as printed, including letters and slashes.

First decide what the document is, using the content, not the file name. A practising licence is renewed and carries an expiry; a registration certificate is issued once and does not. A qualification certificate names an award and an institution; a training certificate names a short course and an awarding body.

Fill only the sections that apply to the kind you chose. Leave the rest null.

Councils and boards you may see, for reference only, transcribe what is printed: ${bodies.join(", ")}.

The document should belong to ${candidateName || "the candidate"}. Set quality.belongs_to_holder false if it clearly names somebody else.

phrases: list any wording in the document that describes clinical skills, specialties, care settings or patient groups, verbatim, so the reference lexicon can map it. Do not invent codes.

not_found: list the fields normally printed on this kind of document that this copy does not show, so we can ask the candidate.`;

// ---------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------

// Legacy .doc files are not zips. Scrape the readable runs of text out of the
// binary rather than giving up on the document altogether.
function binaryText(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  const out: string[] = [];
  let run = "";
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    const printable = (c >= 32 && c < 127) || c === 10 || c === 13 || c === 9;
    if (printable) run += String.fromCharCode(c === 13 ? 10 : c);
    else {
      if (run.trim().length >= 4) out.push(run.trim());
      run = "";
    }
  }
  if (run.trim().length >= 4) out.push(run.trim());
  return out.join(" ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function docxText(bytes: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const file = zip.file("word/document.xml");
    if (file) {
      const xml = await file.async("string");
      const text = xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (text) return text;
    }
  } catch (_) {
    // Not a zip: almost certainly a legacy .doc.
  }
  const scraped = binaryText(bytes);
  return scraped.length >= 200 ? scraped : "";
}


function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function downloadDoc(url: string): Promise<{ buf: ArrayBuffer; ext: string } | null> {
  const path = url.includes("/storage/v1/object/")
    ? decodeURIComponent(url.split(`/${BUCKET}/`)[1] ?? "")
    : url.replace(/^https?:\/\/[^/]+\//, "").replace(new RegExp(`^${BUCKET}/`), "");
  const ext = (path.split(".").pop() || "").toLowerCase();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { buf: await data.arrayBuffer(), ext };
}

type Extraction = Record<string, any>;
type Scalar = { value: string | null; confidence: number; evidence: string | null };

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

async function claudeCall(system: string, content: any[]): Promise<{ extraction?: Extraction; error?: string }> {
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
      system,
      messages: [{ role: "user", content }],
      tools: [{ name: "document_read", description: "Record the document exactly as printed.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "document_read" },
    }),
  });
  if (!res.ok) return { error: `Anthropic error ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const body = await res.json();
  const block = (body?.content || []).find((b: any) => b?.type === "tool_use");
  if (!block?.input) return { error: "Claude returned no structured output" };
  return { extraction: block.input as Extraction };
}

async function readDocument(
  doc: { buf: ArrayBuffer; ext: string },
  filename: string,
  system: string,
): Promise<{ extraction?: Extraction; model?: string; error?: string }> {
  const content: any[] = [
    { type: "text", text: `Read this document and transcribe it as JSON. File name: ${filename}` },
  ];

  if (doc.ext === "pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(doc.buf) } });
  } else if (IMAGE_TYPES[doc.ext]) {
    content.push({ type: "image", source: { type: "base64", media_type: IMAGE_TYPES[doc.ext], data: toBase64(doc.buf) } });
  } else if (doc.ext === "docx" || doc.ext === "doc") {
    const text = await docxText(doc.buf);
    if (!text) return { error: "Could not read the document text" };
    content[0].text += `\n\nDOCUMENT TEXT:\n${text.slice(0, CHUNK_CHARS)}`;
  } else {
    return { error: `Unsupported file type: .${doc.ext}` };
  }

  if (!ANTHROPIC_API_KEY) return { error: "No Anthropic key configured" };
  let attempt = await claudeCall(system, content);
  if (attempt.error) attempt = await claudeCall(system, content);
  if (attempt.error) return { error: attempt.error };
  return { extraction: attempt.extraction, model: CLAUDE_MODEL };
}

// ---------------------------------------------------------------------------
// Corpus: the model reports text, these tables decide the code.
// ---------------------------------------------------------------------------

interface Corpus {
  bodies: { code: string; name: string; variants: string[]; licence_expires: boolean }[];
  awards: { code: string; title: string; variants: string[]; profession: string | null; seniority: string | null }[];
  training: { code: string; name: string; variants: string[]; validity_months: number | null; skill_facets: string[]; specialty_facets: string[] }[];
  phrases: { facet_type: string; code: string; phrase: string; weight: number }[];
}

let corpusCache: { at: number; corpus: Corpus } | null = null;

async function loadCorpus(): Promise<Corpus> {
  if (corpusCache && Date.now() - corpusCache.at < 5 * 60_000) return corpusCache.corpus;
  const [bodies, awards, training, phrases] = await Promise.all([
    admin.from("mu_licensing_bodies").select("code, name, variants, licence_expires").eq("active", true),
    admin.from("mu_awards").select("code, title, variants, profession, seniority").eq("active", true),
    admin.from("mu_training_catalogue").select("code, name, variants, validity_months, skill_facets, specialty_facets").eq("active", true),
    admin.from("mu_lexicon_phrases").select("facet_type, code, phrase, weight").eq("active", true),
  ]);
  const corpus: Corpus = {
    bodies: (bodies.data as any) ?? [],
    awards: (awards.data as any) ?? [],
    training: (training.data as any) ?? [],
    phrases: (phrases.data as any) ?? [],
  };
  corpusCache = { at: Date.now(), corpus };
  return corpus;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9&\s]/g, " ").replace(/\s+/g, " ").trim();

/** Exact name or variant match only. A near miss stays unmapped and is asked about. */
function matchCorpus<T extends { variants: string[] }>(rows: T[], nameOf: (r: T) => string, text: string | null): T | null {
  if (!text) return null;
  const t = norm(text);
  if (!t) return null;
  for (const row of rows) {
    const candidates = [nameOf(row), ...(row.variants ?? [])].map(norm);
    if (candidates.some((c) => c && (t === c || t.includes(c)))) return row;
  }
  return null;
}

/** Every lexicon phrase printed anywhere in the document, as facets. */
function facetsFromPhrases(corpus: Corpus, haystack: string): { facet_type: string; code: string; confidence: number; evidence: string }[] {
  const t = norm(haystack);
  const seen = new Set<string>();
  const out: { facet_type: string; code: string; confidence: number; evidence: string }[] = [];
  for (const p of corpus.phrases) {
    const phrase = norm(p.phrase);
    if (!phrase || phrase.length < 3) continue;
    if (!t.includes(phrase)) continue;
    const key = `${p.facet_type}:${p.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ facet_type: p.facet_type, code: p.code, confidence: Math.min(1, Number(p.weight) || 1), evidence: p.phrase });
  }
  return out;
}

const clamp = (n: any) => Math.max(0, Math.min(1, Number(n) || 0));
const text = (v: any) => (v == null ? null : String(v).trim() || null);
const isScalar = (v: any) => v && typeof v === "object" && "confidence" in v;

function claim(s: any): Scalar | null {
  if (!isScalar(s)) return null;
  const value = text(s.value);
  const evidence = text(s.evidence);
  if (!value || !evidence) return null;
  return { value, confidence: clamp(s.confidence), evidence: evidence.slice(0, 600) };
}

const isoDate = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Every string in the extraction, for phrase matching. */
function flattenText(x: any, acc: string[] = []): string[] {
  if (x == null) return acc;
  if (typeof x === "string") acc.push(x);
  else if (Array.isArray(x)) x.forEach((v) => flattenText(v, acc));
  else if (typeof x === "object") Object.values(x).forEach((v) => flattenText(v, acc));
  return acc;
}

// ---------------------------------------------------------------------------
// Turning an extraction into claims, credentials and facets
// ---------------------------------------------------------------------------

/** Scalar fields this document can contribute to the profile, by kind. */
function scalarClaims(kind: string, x: Extraction, corpus: Corpus): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  const put = (k: string, s: Scalar | null) => {
    if (s) out[k] = s;
  };

  const holder = x.holder ?? {};
  const cred = x.credential ?? {};
  const qual = x.qualification ?? {};
  const nysc = x.nysc ?? {};
  const rtw = x.right_to_work ?? {};
  const emp = x.employment ?? {};

  put("sex", claim(holder.sex));

  if (kind === "proof_of_address" || kind === "government_id") {
    put("state", claim(holder.state));
    put("lga", claim(holder.lga));
  }

  if (kind === "practising_licence" || kind === "registration_certificate") {
    const body = matchCorpus(corpus.bodies, (b) => b.name, claim(cred.licensing_body_text)?.value ?? null);
    const bodyClaim = claim(cred.licensing_body_text);
    if (bodyClaim) {
      put("licensing_body", { ...bodyClaim, value: body ? body.name : bodyClaim.value });
    }
    put("license_number", claim(cred.registration_number));
    // Only a renewable practising licence carries a meaningful expiry.
    if (kind === "practising_licence") put("license_expiry", claim(cred.expiry_date));
  }

  if (kind === "qualification_certificate") {
    const awardClaim = claim(qual.award_text);
    const award = matchCorpus(corpus.awards, (a) => a.title, awardClaim?.value ?? null);
    if (awardClaim) {
      const label = [award ? award.title : awardClaim.value, claim(qual.institution_text)?.value]
        .filter(Boolean)
        .join(", ");
      put("qualification", { ...awardClaim, value: label });
    }
  }

  if (kind === "nysc") put("nysc_status", claim(nysc.nysc_status));
  if (kind === "right_to_work") put("right_to_work", claim(rtw.country) ? { ...claim(rtw.country)!, value: "yes" } : null);
  if (kind === "service_letter") {
    put("employer", claim(emp.employer));
    put("current_position", claim(emp.job_title));
  }

  return out;
}

/** The credential ladder entry this document is evidence for, if any. */
function credentialFor(kind: string, x: Extraction, corpus: Corpus) {
  const cred = x.credential ?? {};
  const train = x.training ?? {};
  const rtw = x.right_to_work ?? {};
  const check = x.check ?? {};

  switch (kind) {
    case "practising_licence":
    case "registration_certificate": {
      const body = matchCorpus(corpus.bodies, (b) => b.name, claim(cred.licensing_body_text)?.value ?? null);
      return {
        credential_type: "licence",
        reference: claim(cred.registration_number)?.value ?? null,
        expires_at: kind === "practising_licence" ? isoDate(claim(cred.expiry_date)?.value) : null,
        note: `Read from a ${kind === "practising_licence" ? "practising licence" : "registration certificate"}${body ? ` issued by ${body.name}` : ""}. Not yet verified.`,
      };
    }
    case "qualification_certificate":
      return {
        credential_type: "qualification",
        reference: claim((x.qualification ?? {}).award_text)?.value ?? null,
        expires_at: null,
        note: "Read from a qualification certificate. Not yet verified.",
      };
    case "training_certificate": {
      const course = claim(train.course_text)?.value ?? null;
      const cat = matchCorpus(corpus.training, (t) => t.name, course);
      const issued = isoDate(claim(train.issue_date)?.value);
      let expires = isoDate(claim(train.expiry_date)?.value);
      // A validity period is arithmetic on a printed issue date, never a guess
      // at one, and it is recorded as a claim so it can be corrected.
      if (!expires && issued && cat?.validity_months) {
        const d = new Date(issued);
        d.setMonth(d.getMonth() + cat.validity_months);
        expires = d.toISOString().slice(0, 10);
      }
      return {
        credential_type: "training",
        reference: cat ? cat.name : course,
        expires_at: expires,
        note: `Read from a training certificate${cat ? ` matched to ${cat.name}` : ""}. Not yet verified.`,
      };
    }
    case "nysc":
      return {
        credential_type: "nysc",
        reference: claim((x.nysc ?? {}).call_up_number)?.value ?? null,
        expires_at: null,
        note: "Read from an NYSC document. Not yet verified.",
      };
    case "government_id":
      return {
        credential_type: "identity",
        reference: claim((x.identity_document ?? {}).id_number)?.value ?? null,
        expires_at: isoDate(claim((x.identity_document ?? {}).expiry_date)?.value),
        note: "Read from a government ID. Not yet verified.",
      };
    case "right_to_work":
      return {
        credential_type: "right_to_work",
        reference: claim(rtw.permit_number)?.value ?? null,
        expires_at: isoDate(claim(rtw.expiry_date)?.value),
        note: "Read from a right to work document. Not yet verified.",
      };
    case "police_clearance":
      return {
        credential_type: "background_check",
        reference: claim(check.issuing_authority)?.value ?? null,
        expires_at: isoDate(claim(check.expiry_date)?.value),
        note: "Read from a police or background check. Not yet verified.",
      };
    case "medical_fitness":
      return {
        credential_type: "medical_fitness",
        reference: claim(check.issuing_authority)?.value ?? null,
        expires_at: isoDate(claim(check.expiry_date)?.value),
        note: "Read from a medical fitness report. Not yet verified.",
      };
    case "reference_letter":
      return {
        credential_type: "reference",
        reference: claim((x.reference ?? {}).referee_name)?.value ?? null,
        expires_at: null,
        note: "Read from a reference letter. Not yet verified.",
      };
    default:
      return null;
  }
}

async function parseDocument(documentId: string, dryRun = false) {
  const { data: docRow } = await admin
    .from("mu_documents")
    .select("id, person_id, label, url, doc_kind, rejected")
    .eq("id", documentId)
    .maybeSingle();
  if (!docRow) return { document_id: documentId, status: "error", message: "Document not found" };

  const { data: person } = await admin
    .from("mu_people")
    .select("id, full_name, profession")
    .eq("id", docRow.person_id)
    .maybeSingle();

  const corpus = await loadCorpus();
  const file = await downloadDoc(docRow.url);
  if (!file) {
    if (!dryRun) {
      await admin.from("mu_document_extractions").insert({
        document_id: docRow.id,
        person_id: docRow.person_id,
        doc_type: docRow.doc_kind ?? "other",
        error: "Could not download the file",
      });
    }
    return { document_id: documentId, status: "failed", message: "Could not download the file" };
  }

  const system = systemPrompt(person?.full_name ?? "", corpus.bodies.map((b) => b.name));
  const result = await readDocument(file, docRow.label || "document", system);
  if (result.error || !result.extraction) {
    if (!dryRun) {
      await admin.from("mu_document_extractions").insert({
        document_id: docRow.id,
        person_id: docRow.person_id,
        doc_type: docRow.doc_kind ?? "other",
        model: CLAUDE_MODEL,
        error: result.error ?? "Unknown read failure",
      });
    }
    return { document_id: documentId, status: "failed", message: result.error };
  }

  const x = result.extraction;
  const usedModel = result.model ?? CLAUDE_MODEL;
  const cls = x.classification ?? {};
  const kind = DOC_KINDS.includes(String(cls.doc_kind)) ? String(cls.doc_kind) : "other";
  const kindConfidence = clamp(cls.confidence);
  const claims = scalarClaims(kind, x, corpus);
  const facets = facetsFromPhrases(corpus, flattenText(x).join(" \n "));
  const cred = credentialFor(kind, x, corpus);
  const notFound: string[] = Array.isArray(x.not_found) ? x.not_found.map(String) : [];
  const quality = x.quality ?? {};

  if (dryRun) {
    return {
      document_id: documentId,
      status: "dry_run",
      doc_kind: kind,
      classification_confidence: kindConfidence,
      model: usedModel,
      claims,
      facets,
      credential: cred,
      not_found: notFound,
      quality,
      extraction: x,
    };
  }

  await admin.from("mu_document_extractions").insert({
    document_id: docRow.id,
    person_id: docRow.person_id,
    doc_type: kind,
    classified_by: "model",
    classification_confidence: kindConfidence,
    classification_evidence: text(cls.evidence),
    model: usedModel,
    extraction: x,
    quality,
    not_found: notFound,
  });

  // Content beats the filename guess.
  await admin
    .from("mu_documents")
    .update({
      doc_kind: kind,
      doc_kind_source: "content",
      doc_kind_confidence: kindConfidence,
      doc_kind_evidence: text(cls.evidence),
      classified_at: new Date().toISOString(),
    })
    .eq("id", docRow.id);

  // Claims: never overwrite anything an admin has already ruled on.
  const { data: settled } = await admin
    .from("mu_parsed_fields")
    .select("field")
    .eq("person_id", docRow.person_id)
    .in("status", ["accepted", "rejected"]);
  const locked = new Set((settled || []).map((r: any) => r.field));

  const belongs = quality.belongs_to_holder;
  const rows = belongs === false
    ? []
    : Object.entries(claims)
        .filter(([field]) => !locked.has(field))
        .map(([field, c]) => ({
          person_id: docRow.person_id,
          document_id: docRow.id,
          field,
          value: c.value,
          confidence: c.confidence,
          evidence: c.evidence,
          model: usedModel,
          status: "pending",
          note: `From ${docRow.label}`,
          reviewed_by: null,
          reviewed_at: null,
        }));
  if (rows.length) await admin.from("mu_parsed_fields").upsert(rows, { onConflict: "person_id,field" });

  // Facets from the printed wording, never demoting a confirmed or verified one.
  const clean = sanitiseFacets(facets);
  let facetCount = 0;
  if (clean.length && belongs !== false) {
    const { data: settledFacets } = await admin
      .from("mu_profile_facets")
      .select("facet_type, code")
      .eq("person_id", docRow.person_id)
      .in("source", ["claimed", "verified"]);
    const lockedFacets = new Set((settledFacets || []).map((r: any) => `${r.facet_type}:${r.code}`));
    const facetRows = clean
      .filter((f) => !lockedFacets.has(`${f.facet_type}:${f.code}`))
      .map((f) => {
        const src = facets.find((r) => r.facet_type === f.facet_type && r.code === f.code);
        return {
          person_id: docRow.person_id,
          facet_type: f.facet_type,
          code: f.code,
          source: "parsed",
          confidence: clamp(src?.confidence ?? 0.6),
          evidence: src?.evidence ? `"${src.evidence}" on ${docRow.label}` : null,
          document_id: docRow.id,
          model: usedModel,
        };
      });
    if (facetRows.length) {
      await admin.from("mu_profile_facets").upsert(facetRows, { onConflict: "person_id,facet_type,code" });
      facetCount = facetRows.length;
    }
  }

  // The credential ladder: a claim with a document behind it, still unverified.
  let credentialTouched = false;
  if (cred && belongs !== false) {
    const { data: existing } = await admin
      .from("mu_credentials")
      .select("id, verified_at, expires_at, evidence_document_id")
      .eq("person_id", docRow.person_id)
      .eq("credential_type", cred.credential_type)
      .maybeSingle();

    if (!existing) {
      await admin.from("mu_credentials").insert({
        person_id: docRow.person_id,
        credential_type: cred.credential_type,
        claim: "yes",
        claim_source: "cv_parsed",
        claim_at: new Date().toISOString(),
        evidence_document_id: docRow.id,
        evidence_at: new Date().toISOString(),
        expires_at: cred.expires_at,
        reference: cred.reference,
        note: cred.note,
      });
      credentialTouched = true;
    } else if (!existing.verified_at) {
      await admin
        .from("mu_credentials")
        .update({
          evidence_document_id: existing.evidence_document_id ?? docRow.id,
          evidence_at: new Date().toISOString(),
          expires_at: existing.expires_at ?? cred.expires_at,
          reference: cred.reference ?? undefined,
        })
        .eq("id", existing.id);
      credentialTouched = true;
    }
  }

  await admin.from("mu_activity").insert({
    person_id: docRow.person_id,
    action: "document_parsed",
    detail: {
      document: docRow.label,
      doc_kind: kind,
      classification_confidence: kindConfidence,
      claims: rows.length,
      facets: facetCount,
      credential: cred?.credential_type ?? null,
      belongs_to_holder: belongs,
      not_found: notFound,
      model: usedModel,
    },
    actor_name: "Document reader",
  });

  return {
    document_id: documentId,
    status: "parsed",
    doc_kind: kind,
    classification_confidence: kindConfidence,
    claims: rows.length,
    facets: facetCount,
    credential: credentialTouched ? cred?.credential_type ?? null : null,
    belongs_to_holder: belongs,
    not_found: notFound,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("PARSE_CV_CRON_SECRET") ?? "";
    const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) return json({ error: "Unauthorised" }, 401);
      const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await caller.auth.getUser();
      const user = userData?.user;
      if (!user) return json({ error: "Unauthorised" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles || []).some((r: any) => r.role === "admin")) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    let ids: string[] = Array.isArray(body.document_ids)
      ? body.document_ids
      : body.document_id
        ? [body.document_id]
        : [];

    // Nothing named: take the next documents that have never been read.
    if (!ids.length) {
      const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
      const { data: queue } = await admin
        .from("mu_documents")
        .select("id")
        .neq("doc_kind", "cv")
        .eq("rejected", false)
        .is("classified_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      ids = (queue || []).map((r: any) => r.id);
      if (!ids.length) return json({ results: [], done: true });
    }

    const clean = ids.filter((v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 25);
    if (!clean.length) return json({ error: "Provide document_id or document_ids" }, 400);

    const results: any[] = new Array(clean.length);
    const CONCURRENCY = 4;
    let cursor = 0;
    const worker = async () => {
      while (cursor < clean.length) {
        const i = cursor++;
        try {
          results[i] = await parseDocument(clean[i], dryRun);
        } catch (e) {
          results[i] = { document_id: clean[i], status: "failed", message: String((e as Error).message).slice(0, 300) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, clean.length) }, worker));

    return json({ results });
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 300) }, 500);
  }
});
