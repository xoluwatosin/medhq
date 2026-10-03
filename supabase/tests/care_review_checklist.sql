-- The review checklist gate, checked without touching a real record.
-- Run with: psql -f supabase/tests/care_review_checklist.sql
BEGIN;

DO $$
DECLARE
  _items text[] := private.care_review_checklist_items();
  _full jsonb := '{}'::jsonb;
  _item text;
BEGIN
  IF array_length(_items, 1) <> 12 THEN
    RAISE EXCEPTION 'the review holds twelve checks, found %', array_length(_items, 1);
  END IF;

  -- Nothing decided.
  IF private.care_review_checklist_problem(NULL) IS NULL THEN
    RAISE EXCEPTION 'an empty checklist must block acceptance';
  END IF;

  FOREACH _item IN ARRAY _items LOOP
    _full := _full || jsonb_build_object(_item, jsonb_build_object('decision', 'met'));
  END LOOP;

  IF private.care_review_checklist_problem(_full) IS NOT NULL THEN
    RAISE EXCEPTION 'a complete checklist must allow acceptance: %',
      private.care_review_checklist_problem(_full);
  END IF;

  -- One check left undecided.
  IF private.care_review_checklist_problem(_full - _items[4]) IS NULL THEN
    RAISE EXCEPTION 'an undecided check must block acceptance';
  END IF;

  -- One check not met: returned, never accepted.
  IF private.care_review_checklist_problem(
       _full || jsonb_build_object(_items[7], jsonb_build_object('decision', 'not_met'))) IS NULL THEN
    RAISE EXCEPTION 'a check that is not met must block acceptance';
  END IF;

  -- Not applicable is a decision.
  IF private.care_review_checklist_problem(
       _full || jsonb_build_object(_items[2], jsonb_build_object('decision', 'not_applicable'))) IS NOT NULL THEN
    RAISE EXCEPTION 'not applicable is a decision';
  END IF;

  RAISE NOTICE 'review checklist gate: pass';
END $$;

ROLLBACK;
