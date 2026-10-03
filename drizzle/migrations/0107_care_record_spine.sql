-- Care record spine: one household per family, relationships recorded, and
-- records that can be held, closed and archived.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Maps a relationship written at intake onto a recorded relationship code.
CREATE OR REPLACE FUNCTION private.care_group_relationship_code(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _raw IS NULL OR btrim(_raw) = '' THEN 'other'
    WHEN lower(_raw) ~ 'mother|mum|mom' THEN 'mother_of'
    WHEN lower(_raw) ~ 'father|dad' THEN 'father_of'
    WHEN lower(_raw) ~ 'parent|guardian' THEN 'parent_or_guardian_of'
    WHEN lower(_raw) ~ 'son|daughter|child' THEN 'child_of'
    WHEN lower(_raw) ~ 'grandmother|grandfather|grandparent' THEN 'grandparent_of'
    WHEN lower(_raw) ~ 'grandson|granddaughter|grandchild' THEN 'grandchild_of'
    WHEN lower(_raw) ~ 'husband|wife|spouse|partner' THEN 'spouse_or_partner_of'
    WHEN lower(_raw) ~ 'brother|sister|sibling' THEN 'sibling_of'
    WHEN lower(_raw) ~ 'friend|neighbour' THEN 'friend_of'
    WHEN lower(_raw) ~ 'aunt|uncle|niece|nephew|cousin|relative|in-law' THEN 'relative_of'
    WHEN lower(_raw) ~ 'doctor|nurse|case manager|employer' THEN 'professional_representative_of'
    ELSE 'other'
  END
$function$;

-- The household for a care record. An existing household reached through a
-- care request is always preferred, so a second household is never created
-- for people who already belong to one.
CREATE OR REPLACE FUNCTION public.care_group_ensure(_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE _group uuid; _request uuid; _client public.clients%ROWTYPE;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _client FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;

  SELECT r.group_id INTO _group
    FROM public.care_request_recipients rr
    JOIN public.care_requests r ON r.id = rr.request_id
   WHERE rr.client_id = _client_id
   ORDER BY r.created_at
   LIMIT 1;

  IF _group IS NULL THEN
    SELECT id INTO _group FROM public.care_groups WHERE origin_client_id = _client_id;
  END IF;

  IF _group IS NULL THEN
    INSERT INTO public.care_groups (display_name, address_line, landmark, state_code, lga_code,
                                    source, origin_client_id, created_by)
    VALUES (_client.full_name, _client.address_line, _client.landmark, _client.state_code,
            _client.lga_code, 'backfill', _client_id, auth.uid())
    RETURNING id INTO _group;
  END IF;

  SELECT r.id INTO _request FROM public.care_requests r
    WHERE r.group_id = _group ORDER BY r.created_at LIMIT 1;
  IF _request IS NULL THEN
    INSERT INTO public.care_requests (group_id, status, source, created_from_submission_id, created_by)
    VALUES (_group, 'open', 'backfill', _client.created_from_submission_id, auth.uid())
    RETURNING id INTO _request;
  END IF;

  INSERT INTO public.care_request_recipients (request_id, client_id, address_line, landmark,
                                              state_code, lga_code, display_order, created_by)
  VALUES (_request, _client_id, _client.address_line, _client.landmark, _client.state_code,
          _client.lga_code, 1, auth.uid())
  ON CONFLICT (request_id, client_id) DO NOTHING;

  RETURN _group;
END;
$function$;

-- The people linked to a care record: the household it belongs to, the other
-- people in that household, and how each of them is related.
CREATE OR REPLACE FUNCTION public.care_client_links(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE _group uuid; _out jsonb;
BEGIN
  PERFORM private.care_group_admin_guard();

  SELECT r.group_id INTO _group
    FROM public.care_request_recipients rr
    JOIN public.care_requests r ON r.id = rr.request_id
   WHERE rr.client_id = _client_id
   ORDER BY r.created_at LIMIT 1;
  IF _group IS NULL THEN
    SELECT id INTO _group FROM public.care_groups WHERE origin_client_id = _client_id;
  END IF;
  IF _group IS NULL THEN
    RETURN jsonb_build_object('household', NULL, 'people', '[]'::jsonb);
  END IF;

  SELECT jsonb_build_object(
    'household', (SELECT jsonb_build_object('id', g.id, 'display_name', g.display_name,
                           'address_line', g.address_line, 'landmark', g.landmark,
                           'state_code', g.state_code, 'lga_code', g.lga_code, 'status', g.status)
                    FROM public.care_groups g WHERE g.id = _group),
    'people', COALESCE((
      SELECT jsonb_agg(person ORDER BY person ->> 'full_name')
      FROM (
        SELECT DISTINCT ON (p.id) jsonb_build_object(
          'person_id', p.id,
          'full_name', p.full_name,
          'email', p.email,
          'phone', p.phone,
          'roles', (SELECT COALESCE(jsonb_agg(DISTINCT m.role), '[]'::jsonb)
                      FROM public.care_group_members m
                     WHERE m.group_id = _group AND m.person_id = p.id),
          'client_id', (SELECT rr2.client_id FROM public.care_request_recipients rr2
                          JOIN public.care_requests r2 ON r2.id = rr2.request_id
                         WHERE r2.group_id = _group AND rr2.person_id = p.id
                         ORDER BY rr2.created_at LIMIT 1),
          'relationships', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'id', rel.id, 'to_person_id', rel.to_person_id,
                                'code', rel.relationship_code, 'other_label', rel.other_label,
                                'label', t.label,
                                'to_name', tp.full_name)), '[]'::jsonb)
                              FROM public.care_person_relationships rel
                              JOIN public.care_people tp ON tp.id = rel.to_person_id
                              LEFT JOIN public.care_group_relationship_terms t ON t.code = rel.relationship_code
                             WHERE rel.from_person_id = p.id)
        ) AS person
        FROM public.care_people p
        WHERE p.id IN (
          SELECT m.person_id FROM public.care_group_members m WHERE m.group_id = _group
          UNION
          SELECT rr.person_id FROM public.care_request_recipients rr
            JOIN public.care_requests r ON r.id = rr.request_id
           WHERE r.group_id = _group AND rr.person_id IS NOT NULL
          UNION
          SELECT r.enquirer_person_id FROM public.care_requests r
           WHERE r.group_id = _group AND r.enquirer_person_id IS NOT NULL
        )
      ) people
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END;
$function$;

-- Holding, closing, archiving and reopening a care record.
CREATE OR REPLACE FUNCTION public.care_client_lifecycle(_client_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE _c public.clients%ROWTYPE;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;

  IF _action = 'hold' THEN
    IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Record why this file is on hold'; END IF;
    UPDATE public.clients SET paused_at = now(), paused_reason = btrim(_reason), updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'resume' THEN
    UPDATE public.clients SET paused_at = NULL, paused_reason = NULL, updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'close' THEN
    IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Record why this file is closed'; END IF;
    UPDATE public.clients SET closed_at = now(), closed_reason = btrim(_reason), updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'reopen' THEN
    UPDATE public.clients SET closed_at = NULL, closed_reason = NULL, archived_at = NULL,
           archived_by = NULL, updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'archive' THEN
    IF _c.closed_at IS NULL THEN RAISE EXCEPTION 'Close this file before archiving it'; END IF;
    UPDATE public.clients SET archived_at = now(), archived_by = auth.uid(), updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'restore' THEN
    UPDATE public.clients SET archived_at = NULL, archived_by = NULL, updated_at = now()
     WHERE id = _client_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor)
  VALUES (_client_id, 'lifecycle_' || _action,
          jsonb_build_object('reason', NULLIF(btrim(COALESCE(_reason, '')), '')), auth.uid());

  PERFORM public.care_refresh_stage(_client_id);

  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  RETURN jsonb_build_object('stage', _c.stage, 'closed_at', _c.closed_at,
    'paused_at', _c.paused_at, 'archived_at', _c.archived_at);
END;
$function$;

-- Closing and reopening a care request.
CREATE OR REPLACE FUNCTION public.care_request_lifecycle(_request_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE _r public.care_requests%ROWTYPE;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _r FROM public.care_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care request not found'; END IF;

  IF _action = 'close' THEN
    IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Record why this request is closed'; END IF;
    UPDATE public.care_requests SET status = 'closed', updated_at = now() WHERE id = _request_id;
  ELSIF _action = 'reopen' THEN
    UPDATE public.care_requests SET status = 'open', updated_at = now() WHERE id = _request_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor)
  SELECT rr.client_id, 'request_' || _action,
         jsonb_build_object('request_id', _request_id,
           'reason', NULLIF(btrim(COALESCE(_reason, '')), '')), auth.uid()
    FROM public.care_request_recipients rr WHERE rr.request_id = _request_id;

  RETURN jsonb_build_object('request_id', _request_id, 'status',
    (SELECT status FROM public.care_requests WHERE id = _request_id));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.care_client_links(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_lifecycle(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_request_lifecycle(uuid, text, text) TO authenticated, service_role;
