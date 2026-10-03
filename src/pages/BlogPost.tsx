import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MAP, PolaroidFrame, CleanEditorial } from "@/components/blog-templates";
import SEO from "@/components/SEO";

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  category: string;
  featured_image_url: string | null;
  hero_template: string;
  polaroid_caption: string | null;
  body_template: string | null;
  body_images: string[];
  body_captions: string[];
  status: string;
  published_at: string;
  drop_cap_enabled: boolean;
}

interface RelatedPost {
  title: string;
  slug: string;
  featured_image_url: string | null;
  published_at: string;
  category: string;
}

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, content, category, author, featured_image_url, published_at, hero_template, body_template, body_images, body_captions, polaroid_caption, status, drop_cap_enabled")
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const postData = {
            ...data,
            body_images: Array.isArray(data.body_images) ? (data.body_images as string[]) : [],
            body_captions: Array.isArray((data as any).body_captions) ? ((data as any).body_captions as string[]) : [],
          };
          setPost(postData);
          // Fetch related posts
          supabase
            .from("blog_posts")
            .select("title, slug, featured_image_url, published_at, category")
            .eq("status", "published")
            .lte("published_at", new Date().toISOString())
            .eq("category", data.category)
            .neq("slug", data.slug)
            .order("published_at", { ascending: false })
            .limit(3)
            .then(({ data: related }) => {
              if (related) setRelatedPosts(related as RelatedPost[]);
            });
        }
        setLoading(false);
      });
  }, [slug]);

  // Reading progress bar
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <MedicHeader />
        <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-dvh bg-background">
        <MedicHeader />
        <div className="text-center py-32">
          <h1 className="text-2xl font-semibold mb-4">Post not found</h1>
          <Button asChild><Link to="/blog"><ArrowLeft className="mr-2 h-4 w-4" />Back to Blog</Link></Button>
        </div>
        <Footer />
      </div>
    );
  }

  const BodyTemplate = TEMPLATE_MAP[post.body_template || "clean-editorial"] || CleanEditorial;

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title={`${post.title} | The Bridge`}
        description={post.excerpt || `${post.title} — from The Bridge.`}
        path={`/blog/${post.slug}`}
        image={post.featured_image_url || undefined}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": post.title,
          "description": post.excerpt,
          "image": post.featured_image_url || undefined,
          "author": { "@type": "Person", "name": post.author },
          "datePublished": post.published_at,
          "publisher": {
            "@type": "Organization",
            "name": "Medic Connect",
            "logo": { "@type": "ImageObject", "url": "https://www.medicconnect.co/favicon.png" }
          },
          "mainEntityOfPage": `https://www.medicconnect.co/blog/${post.slug}`,
          "articleSection": post.category
        }}
      />
      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 h-[3px] bg-primary z-50 transition-[width] duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      <MedicHeader />

      {/* Hero — Substack-style: image on top, title + meta below, generous whitespace */}
      {post.hero_template === "polaroid" ? (
        <section className="bg-accent py-10 sm:py-16">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-accent-foreground">
              <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mb-4">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Blog
              </Link>
              <span className="block text-xs font-medium uppercase tracking-[0.15em] opacity-70">{post.category}</span>
              <h1 className="text-[2rem] sm:text-4xl lg:text-5xl font-semibold mt-3 mb-4 leading-[1.15] tracking-tight">{post.title}</h1>
              <p className="text-base sm:text-lg opacity-80 leading-relaxed">{post.excerpt}</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm font-medium">By {post.author}</span>
                <span className="text-[11px] uppercase tracking-[0.18em] opacity-60 border-l border-current/30 pl-3">
                  {new Date(post.published_at).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
            {post.featured_image_url && (
              <div className="flex-shrink-0 w-64 sm:w-72 md:w-[35%]">
                <PolaroidFrame
                  src={post.featured_image_url}
                  caption={post.polaroid_caption || undefined}
                  rotation={-3}
                  variant="tape"
                  className="w-full"
                />
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="relative h-[420px] sm:h-[60vh] flex items-end overflow-hidden">
          {post.featured_image_url && (
            <img fetchPriority="high" src={post.featured_image_url} alt={post.title} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-transparent" />
          <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 pb-12 w-full">
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-background hover:text-background/80 transition-colors mb-3 bg-primary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Blog
            </Link>
            <span className="block text-sm font-medium uppercase tracking-wider text-background/70">{post.category}</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-background mt-2 mb-3">{post.title}</h1>
            <div className="mt-2 flex items-center gap-3 text-background/85">
              <span className="text-sm font-medium">By {post.author}</span>
              <span className="text-[11px] uppercase tracking-[0.18em] opacity-80 border-l border-background/40 pl-3">
                {new Date(post.published_at).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </section>

      )}

      {/* Body */}
      <BodyTemplate content={post.content} bodyImages={post.body_images} bodyCaptions={post.body_captions} dropCapEnabled={post.drop_cap_enabled !== false} />

      {/* Thanks for reading sign-off */}
      <section className="border-t border-border/60 py-12 mt-8">
        <div className="max-w-[680px] mx-auto px-5 sm:px-6 text-center">
          <p className="text-2xl sm:text-3xl italic text-primary mb-3">Thanks for reading.</p>
          <p className="text-sm text-muted-foreground">Written by {post.author}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Published {new Date(post.published_at).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <div className="mt-6">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/blog"><ArrowLeft className="mr-2 h-4 w-4" />More Articles</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="max-w-[680px] mx-auto px-5 sm:px-6 pt-8 pb-4">
          <div className="pt-10">
            <h3 className="text-xl font-semibold mb-6">More from The Bridge</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedPosts.map((rp) => (
                <Link key={rp.slug} to={`/blog/${rp.slug}`} className="group">
                  {rp.featured_image_url && (
                    <img loading="lazy" decoding="async"
                      src={rp.featured_image_url}
                      alt={rp.title}
                      className="w-full h-36 object-cover kit-curve-sm mb-3 group-hover:opacity-90 transition-opacity"
                    />
                  )}
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{rp.category}</p>
                  <h4 className="font-semibold text-sm mt-1 group-hover:text-primary transition-colors leading-snug">
                    {rp.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(rp.published_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/blog"><ArrowLeft className="mr-2 h-4 w-4" />All Articles</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default BlogPost;
