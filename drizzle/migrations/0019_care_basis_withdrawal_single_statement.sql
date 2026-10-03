-- The scope and the state have to move in the same statement, or the row is
-- momentarily an active grant with nothing in it and the check refuses it.
CREATE OR REPLACE FUNCTION public.care_basis_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL THEN
    UPDATE public.care_access_grants g
      SET clinical_scope = CASE WHEN g.clinical_basis_id = NEW.id THEN false ELSE g.clinical_scope END,
          clinical_basis_id = CASE WHEN g.clinical_basis_id = NEW.id THEN NULL ELSE g.clinical_basis_id END,
          finance_scope = CASE WHEN g.finance_basis_id = NEW.id THEN false ELSE g.finance_scope END,
          finance_basis_id = CASE WHEN g.finance_basis_id = NEW.id THEN NULL ELSE g.finance_basis_id END,
          -- Nothing is deleted: a grant left with no scope is kept as history
          -- and suspended so it opens nothing.
          state = CASE
            WHEN g.state = 'active'
             AND NOT (g.journey_scope
               OR (CASE WHEN g.clinical_basis_id = NEW.id THEN false ELSE g.clinical_scope END)
               OR (CASE WHEN g.finance_basis_id = NEW.id THEN false ELSE g.finance_scope END))
            THEN 'suspended' ELSE g.state END,
          suspended_at = CASE
            WHEN g.state = 'active'
             AND NOT (g.journey_scope
               OR (CASE WHEN g.clinical_basis_id = NEW.id THEN false ELSE g.clinical_scope END)
               OR (CASE WHEN g.finance_basis_id = NEW.id THEN false ELSE g.finance_scope END))
            THEN COALESCE(g.suspended_at, now()) ELSE g.suspended_at END
      WHERE g.clinical_basis_id = NEW.id OR g.finance_basis_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;