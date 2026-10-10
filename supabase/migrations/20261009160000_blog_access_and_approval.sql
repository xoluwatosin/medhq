-- Blog: everyone writes, only the owner publishes.
--
-- Until now the approval step lived only in the post editor, so anyone with
-- the blog area could publish straight through the API. This moves the rule
-- into the database: when an admin who needs approval tries to put a post
-- live (publish or schedule, or edit one that is already live), it is saved
-- as a draft waiting for approval instead. Only the owner can approve or send
-- back. Service jobs (no signed-in user) are not touched.

CREATE OR REPLACE FUNCTION private.blog_posts_approval_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _needs boolean;
  _going_live boolean;
BEGIN
  IF _uid IS NULL OR private.is_super_admin(_uid) THEN RETURN NEW; END IF;

  SELECT COALESCE(bool_or(requires_blog_approval), true) INTO _needs
    FROM public.admin_permissions WHERE user_id = _uid AND is_active;
  IF NOT COALESCE(_needs, true) THEN RETURN NEW; END IF;

  -- Only the owner approves or sends back.
  IF TG_OP = 'INSERT' THEN
    IF NEW.approval_status IN ('approved', 'rejected') THEN NEW.approval_status := NULL; END IF;
  ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status AND NEW.approval_status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Only the owner can approve or send back a post' USING ERRCODE = '42501';
  END IF;

  IF NEW.status NOT IN ('published', 'scheduled') THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' OR OLD.status NOT IN ('published', 'scheduled') THEN
    _going_live := true;
  ELSE
    -- Already live: any change to what readers see needs approval again.
    _going_live := (NEW.title, NEW.slug, NEW.content, NEW.excerpt, NEW.author, NEW.category,
                    NEW.featured_image_url, NEW.hero_template, NEW.polaroid_caption, NEW.body_template,
                    NEW.body_images, NEW.body_captions, NEW.drop_cap_enabled, NEW.published_at, NEW.status)
               IS DISTINCT FROM
                   (OLD.title, OLD.slug, OLD.content, OLD.excerpt, OLD.author, OLD.category,
                    OLD.featured_image_url, OLD.hero_template, OLD.polaroid_caption, OLD.body_template,
                    OLD.body_images, OLD.body_captions, OLD.drop_cap_enabled, OLD.published_at, OLD.status);
  END IF;

  IF _going_live THEN
    NEW.status := 'draft';
    NEW.approval_status := 'pending';
    NEW.approval_note := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$ BEGIN
  CREATE TRIGGER blog_posts_approval_guard
    BEFORE INSERT OR UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION private.blog_posts_approval_guard();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Signed-in people who are not admins (staff, candidates) read the public
-- blog too. Before this only signed-out visitors could.
DO $$ BEGIN
  CREATE POLICY "Signed in can read published posts" ON public.blog_posts FOR SELECT TO authenticated
    USING (status = 'published' AND published_at <= now());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data, at the owner's request: every active admin gets the blog area, and
-- everyone but the owner needs approval to publish.
-- UPDATE public.admin_permissions
--    SET permissions = permissions || '["blog"]'::jsonb, updated_at = now()
--  WHERE is_active AND NOT permissions ? 'blog';
-- UPDATE public.admin_permissions SET requires_blog_approval = true, updated_at = now()
--  WHERE is_active AND user_id <> 'af2fac7f-86db-483f-831e-3cb38454a30c';
