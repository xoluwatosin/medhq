-- Every client contact must stand for a human. The insert trigger fills the
-- person when one is not supplied; this makes it a database invariant rather
-- than a trigger promise. Foreign key and ON DELETE RESTRICT are unchanged.
DO $ensure$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM public.client_contacts WHERE person_id IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'Cannot require person_id: % contacts have none', missing;
  END IF;
END
$ensure$;

ALTER TABLE public.client_contacts ALTER COLUMN person_id SET NOT NULL;
