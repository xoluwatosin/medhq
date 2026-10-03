-- Turn a conflict into a candidate question, without requiring an admin actor.
CREATE OR REPLACE FUNCTION public.mu_conflict_to_candidate(_conflict_id uuid, _actor uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.mu_field_conflicts; _note text;
BEGIN
  SELECT * INTO c FROM public.mu_field_conflicts WHERE id = _conflict_id;
  IF c.id IS NULL OR c.status NOT IN ('open') THEN RETURN; END IF;

  _note := CASE WHEN coalesce(btrim(c.stored_value), '') = ''
            THEN 'We could not confirm this. Please tell us the right answer.'
            ELSE 'Your documents say "' || coalesce(c.parsed_value, '') || '" but your profile says "' ||
                 coalesce(c.stored_value, '') || '". Please confirm which is right.' END;

  IF c.parsed_field_id IS NOT NULL THEN
    UPDATE public.mu_parsed_fields
       SET status = 'queried', note = _note, updated_at = now()
     WHERE id = c.parsed_field_id AND status NOT IN ('candidate_updated');
  END IF;

  UPDATE public.mu_field_conflicts
     SET status = 'asked_candidate', updated_at = now()
   WHERE id = _conflict_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (c.person_id, _actor, 'System', 'field_conflict_asked_candidate',
          jsonb_build_object('field', c.field, 'stored_value', c.stored_value, 'parsed_value', c.parsed_value));
END;
$$;

REVOKE ALL ON FUNCTION public.mu_conflict_to_candidate(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_conflict_to_candidate(uuid, uuid) TO authenticated, service_role;

-- Every new disagreement routes itself to the candidate.
CREATE OR REPLACE FUNCTION public.mu_field_conflicts_auto_ask()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.mu_conflict_to_candidate(NEW.id, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mu_field_conflicts_auto_ask ON public.mu_field_conflicts;
CREATE TRIGGER trg_mu_field_conflicts_auto_ask
AFTER INSERT ON public.mu_field_conflicts
FOR EACH ROW EXECUTE FUNCTION public.mu_field_conflicts_auto_ask();

-- When the candidate answers, the disagreement closes itself.
CREATE OR REPLACE FUNCTION public.mu_parsed_field_closes_conflict()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('candidate_updated', 'accepted', 'rejected', 'superseded') THEN
    UPDATE public.mu_field_conflicts
       SET status = CASE WHEN NEW.status = 'candidate_updated' THEN 'resolved_by_candidate' ELSE 'closed' END,
           updated_at = now()
     WHERE parsed_field_id = NEW.id AND status IN ('open', 'asked_candidate');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mu_parsed_field_closes_conflict ON public.mu_parsed_fields;
CREATE TRIGGER trg_mu_parsed_field_closes_conflict
AFTER UPDATE ON public.mu_parsed_fields
FOR EACH ROW EXECUTE FUNCTION public.mu_parsed_field_closes_conflict();

-- Backfill: push every open disagreement to the candidate now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.mu_field_conflicts WHERE status = 'open' LOOP
    PERFORM public.mu_conflict_to_candidate(r.id, NULL);
  END LOOP;
END $$;

-- Close any conflict whose parsed row has already been answered or settled.
UPDATE public.mu_field_conflicts c
   SET status = CASE WHEN f.status = 'candidate_updated' THEN 'resolved_by_candidate' ELSE 'closed' END,
       updated_at = now()
  FROM public.mu_parsed_fields f
 WHERE f.id = c.parsed_field_id
   AND c.status IN ('open', 'asked_candidate')
   AND f.status IN ('candidate_updated', 'accepted', 'rejected', 'superseded');

-- Read-only list for admins: what we are waiting on the candidate for.
CREATE OR REPLACE FUNCTION public.mu_awaiting_candidate(_limit integer DEFAULT 200)
RETURNS TABLE(
  id uuid, person_id uuid, full_name text, email text, field text,
  stored_value text, parsed_value text, asked_at timestamptz, created_at timestamptz,
  claimed boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.person_id, p.full_name, p.email, c.field, c.stored_value, c.parsed_value,
         c.updated_at AS asked_at, c.created_at,
         p.auth_user_id IS NOT NULL AS claimed
    FROM public.mu_field_conflicts c
    JOIN public.mu_people p ON p.id = c.person_id
   WHERE private.has_role(auth.uid(), 'admin'::app_role)
     AND c.status IN ('open', 'asked_candidate')
   ORDER BY c.updated_at DESC
   LIMIT coalesce(_limit, 200);
$$;

REVOKE ALL ON FUNCTION public.mu_awaiting_candidate(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_awaiting_candidate(integer) TO authenticated, service_role;