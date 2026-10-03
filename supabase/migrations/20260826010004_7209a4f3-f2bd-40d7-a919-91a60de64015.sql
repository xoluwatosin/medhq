-- Re-map the auxiliary-nursing certificate to Nursing Assistant
UPDATE public.mu_awards
SET profession = 'Nursing Assistant'
WHERE code = 'AUXNUR';

-- Safety: normalise any legacy 'Auxiliary Nurse' values that may exist
UPDATE public.mu_people
SET profession = 'Nursing Assistant'
WHERE profession = 'Auxiliary Nurse';

UPDATE public.mu_field_conflicts
SET stored_value = 'Nursing Assistant'
WHERE field = 'profession' AND stored_value = 'Auxiliary Nurse';

UPDATE public.mu_field_conflicts
SET parsed_value = 'Nursing Assistant'
WHERE field = 'profession' AND parsed_value = 'Auxiliary Nurse';

UPDATE public.matchmaker_opportunities
SET match_professions = array_replace(match_professions, 'Auxiliary Nurse', 'Nursing Assistant')
WHERE 'Auxiliary Nurse' = ANY(match_professions);