// Writes a candidate makes about themselves. Kept out of the screens so the
// same rules apply wherever the question is answered.
import { supabase } from "@/integrations/supabase/client";
import { DOC_CREDENTIAL, docTypeOf } from "@/lib/match-universe";

// Fields the candidate is the authority on. Their answer goes onto the profile
// through one function, so every change is written to the activity trail as
// well as the record itself.
export const PROFILE_FIELDS = new Set([
  "state", "lga", "profession", "licensing_body", "license_number", "license_expiry",
  "sex", "nysc_status", "right_to_work", "languages",
  "address_line", "address_landmark", "address_area",
  "track", "institution", "course_of_study", "study_level", "year_of_study",
  "expected_graduation", "joining_statement",
]);


// Answered on their own screens, never as a line of text.
const NOT_TEXT = new Set(["references", "work_preferences", "availability", "cv", "documents"]);

export const settlePortalFields = async (
  patch: Record<string, unknown>,
  personId?: string,
) => {
  const settlements = await Promise.all(
    Object.entries(patch)
      .filter(([field, value]) => PROFILE_FIELDS.has(field) && value !== null && value !== undefined)
      .map(([field, value]) => {
        let q = supabase.from("mu_parsed_fields" as any)
          .update({ value: String(value), status: "candidate_updated" })
          .eq("field", field);
        // Scope to the person whenever we know them, so a settlement can only
        // ever touch that candidate's own proposals.
        if (personId) q = q.eq("person_id", personId) as any;
        return q;
      }),
  );
  return settlements.find((result) => result.error)?.error?.message ?? null;
};

/** One door for every candidate-side profile change, trail included. */
export const updateOwnProfile = async (patch: Record<string, string>, personId?: string) => {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PROFILE_FIELDS.has(k)) clean[k] = v;
  }
  if (!Object.keys(clean).length) return { error: null };
  const { error } = await supabase.rpc("mu_candidate_update_profile" as any, { _patch: clean });
  if (error) return { error: error.message };

  // Profile questions can also be answered during onboarding or from Your
  // details. Settle their imported proposals here so those answers do not
  // return to the home queue after a successful save.
  return { error: await settlePortalFields(clean, personId) };
};


export const savePortalField = async (
  personId: string,
  row: { id: string; field: string },
  value: string,
) => {
  if (NOT_TEXT.has(row.field)) return { error: null };

  // The profile is the record. Only a document read writes to the extraction
  // table, so a candidate answer is never mistaken for something we parsed.
  if (PROFILE_FIELDS.has(row.field)) {
    const profileResult = await updateOwnProfile({ [row.field]: value }, personId);
    if (profileResult.error) return profileResult;
    return { error: null };
  }

  if (!row.id.startsWith("gap:")) {
    const { data, error } = await supabase.from("mu_parsed_fields" as any)
      .update({ value, status: "candidate_updated" })
      .eq("person_id", personId)
      .eq("field", row.field)
      .select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "The confirmation was not saved." };
  }
  // candidate_gaps is derived in the database. Answering is what clears it.
  return { error: null };
};

export const uploadPortalDocument = async (
  userId: string,
  personId: string,
  file: File,
  docLabel: string,
) => {
  // PDF only: the applications bucket accepts PDF and the portal tells candidates
  // to send PDFs. Reject anything else before it reaches storage.
  const isPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return { error: "Please send a PDF file. Photographs and other file types cannot be accepted." };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `candidate/${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("applications").upload(path, file, { upsert: false });
  if (error) return { error };

  const label = docLabel === "auto" ? docTypeOf(file.name) : docLabel;
  const { data: doc } = await supabase
    .from("mu_documents" as any)
    .insert({
      person_id: personId,
      source_table: "candidate_portal",
      label: `${label} — ${file.name}`,
      url: path,
      verified: false,
      rejected: false,
    })
    .select("id")
    .maybeSingle();

  // A document is only evidence once it is attached to a credential.
  const credentialType = DOC_CREDENTIAL[label as string];
  if (doc && credentialType) {
    await supabase.rpc("mu_attach_credential_document" as any, {
      _person_id: personId,
      _credential_type: credentialType,
      _document_id: (doc as any).id,
      _claim_source: "form",
    });
  }
  return { error: null };
};
