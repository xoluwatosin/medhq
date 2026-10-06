// www.medicconnect.co/b/<code>: the short share link for a blog post. The
// pre-rendered copy at this address gives link previews the post's title and
// image; here the visitor is sent on to the post's full address.
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { shortCode } from "@/lib/short-link";

const BlogShortLink = () => {
  const { code } = useParams();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void supabase
      .from("blog_posts")
      .select("slug")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .then(({ data }) => {
        if (!live) return;
        const slug = (data ?? []).find((p) => shortCode(p.slug) === code)?.slug;
        setTarget(slug ? `/blog/${slug}` : "/blog");
      });
    return () => { live = false; };
  }, [code]);

  return target ? <Navigate to={target} replace /> : null;
};

export default BlogShortLink;
