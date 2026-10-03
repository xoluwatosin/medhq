-- Composite indexes behind mu_match_candidates / mu_match_report.
-- The matcher joins facets by (facet_type, code) then back to the person,
-- reads credentials per (person, type), and counts documents per person.
CREATE INDEX IF NOT EXISTS mu_profile_facets_code_person_idx
  ON public.mu_profile_facets (facet_type, code, person_id);

CREATE INDEX IF NOT EXISTS mu_profile_facets_person_type_idx
  ON public.mu_profile_facets (person_id, facet_type);

CREATE INDEX IF NOT EXISTS mu_credentials_person_type_idx
  ON public.mu_credentials (person_id, credential_type);

CREATE INDEX IF NOT EXISTS mu_documents_person_live_idx
  ON public.mu_documents (person_id, verified)
  WHERE rejected = false;

-- Hard filters scan mu_people by profession and location.
CREATE INDEX IF NOT EXISTS mu_people_profession_idx
  ON public.mu_people (profession)
  WHERE profession IS NOT NULL;

CREATE INDEX IF NOT EXISTS mu_people_state_lga_idx
  ON public.mu_people (state, lga);

CREATE INDEX IF NOT EXISTS mu_shortlists_opportunity_person_idx
  ON public.mu_shortlists (opportunity_id, person_id);

CREATE INDEX IF NOT EXISTS mu_shortlists_person_status_idx
  ON public.mu_shortlists (person_id, status);

ANALYZE public.mu_profile_facets;
ANALYZE public.mu_credentials;
ANALYZE public.mu_documents;
ANALYZE public.mu_people;