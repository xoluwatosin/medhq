import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import { TEMPLATE_MAP, CleanEditorial } from "@/components/blog-templates";
import SEO from "@/components/SEO";
import CareRequestDialog from "@/components/CareRequestDialog";
import { Chevrons, Stamp, Tape, TapeLabel, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import PostCard, { firstParagraph, postDate, readMinutes } from "@/components/blog/PostCard";
import { cn } from "@/lib/utils";

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
  author: string;
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
            .select("title, slug, featured_image_url, published_at, category, author")
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

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-background">
      <MedicHeader />
      <section className="relative -mt-[80px] overflow-hidden bg-navy pb-16 pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
        <Watermark glyph="o" size={300} opacity={0.12} className="-right-[90px] -top-[30px]" />
        <div className="relative mx-auto max-w-[860px] px-[22px] sm:px-[50px]">{children}</div>
      </section>
      <Footer />
    </div>
  );

  if (loading) {
    return shell(
      <div aria-busy="true" aria-label="Loading the story" className="space-y-4">
        <div className="h-5 w-28 animate-pulse bg-white/10" />
        <div className="h-12 w-full animate-pulse bg-white/10" />
        <div className="h-12 w-2/3 animate-pulse bg-white/10" />
      </div>,
    );
  }

  if (!post) {
    return shell(
      <div className="flex flex-col items-start gap-5">
        <p className="eyebrow !text-brand-soft">The Bridge</p>
        <h1 className="text-[34px] leading-[1.05] tracking-[-0.05em] !text-white sm:text-[48px]">We could not find that story.</h1>
        <Link to="/blog" className="inline-flex min-h-[48px] items-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy shadow-offset-blue">
          See all stories
        </Link>
      </div>,
    );
  }

  const BodyTemplate = TEMPLATE_MAP[post.body_template || "clean-editorial"] || CleanEditorial;
  const lede = firstParagraph(post.excerpt);
  const date = postDate(post.published_at, "long");

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title={`${post.title} | The Bridge`}
        description={lede || `${post.title}, from The Bridge.`}
        path={`/blog/${post.slug}`}
        image={post.featured_image_url || undefined}
        imageAlt={post.featured_image_url ? post.title : undefined}
        type="article"
        publishedTime={post.published_at}
        // Search results show this trail under the title; without it Google
        // falls back to the hyphenated address.
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "The Bridge", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": post.title,
          "description": lede,
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
      {/* Reading progress */}
      <div className="fixed left-0 top-0 z-50 h-[4px] bg-brand transition-[width] duration-150" style={{ width: `${scrollProgress}%` }} />

      <MedicHeader />

      {/* The headline on navy; the photo hangs from the bottom edge like a pinned print. */}
      <section className={cn("relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]", post.featured_image_url ? "pb-[150px] sm:pb-[220px]" : "pb-16")}>
        <Watermark glyph="o" size={620} opacity={0.12} className="-right-[200px] -top-[120px] hidden lg:block" />
        <Watermark glyph="o" size={300} opacity={0.12} className="-right-[90px] -top-[30px] lg:hidden" />
        <div className="relative mx-auto max-w-[860px] px-[22px] sm:px-[50px]">
          <Link to="/blog" className="text-[14px] font-extrabold text-brand-soft hover:text-white">
            <span aria-hidden="true">←</span> The Bridge
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {post.category && (
              <TapeLabel tone="blue" tilt={-2} className="uppercase">
                {post.category}
              </TapeLabel>
            )}
            <TapeLabel tone="tint" tilt={2}>
              {readMinutes(post.content)} MIN READ
            </TapeLabel>
          </div>
          <h1 className="mt-4 text-[32px] leading-[1.04] tracking-[-0.05em] !text-white sm:text-[48px] lg:text-[56px]">{post.title}</h1>
          {lede && <p className="mt-5 line-clamp-4 max-w-[60ch] text-[16px] leading-[1.6] text-body-navy sm:text-[19px]">{lede}</p>}
          <p className="mt-6 text-[14px] font-bold text-white">
            By {post.author}
            <span className="mt-1 block font-semibold text-body-navy sm:ml-3 sm:mt-0 sm:inline">{date}</span>
          </p>
        </div>
      </section>

      {post.featured_image_url && (
        <div className="relative mx-auto -mt-[120px] max-w-[860px] px-[22px] sm:-mt-[190px] sm:px-[50px]">
          <figure className={cn("relative border-2 border-navy bg-white p-3 pb-12 shadow-offset sm:p-4 sm:pb-14", post.hero_template === "polaroid" ? "rotate-[-2deg]" : "rotate-[-1deg]")}>
            <Tape width={130} tilt={-3} className="-top-3 left-1/2 z-10 -ml-[65px]" />
            <Tape width={70} tilt={40} className="-right-5 top-3 hidden sm:block" />
            <img fetchPriority="high" src={post.featured_image_url} alt="" className="aspect-[16/9] w-full object-cover" />
            <figcaption className="absolute bottom-3 left-4 right-4 truncate text-[14px] font-extrabold text-navy sm:bottom-4 sm:left-5 sm:text-[15px]">
              {post.polaroid_caption || `${post.category || "The Bridge"}, ${date}`}
            </figcaption>
          </figure>
        </div>
      )}

      <div className="pt-10 sm:pt-14">
        <BodyTemplate content={post.content} bodyImages={post.body_images} bodyCaptions={post.body_captions} dropCapEnabled={post.drop_cap_enabled !== false} />
      </div>

      {/* Sign-off: who wrote it, then a way to get help. */}
      <section className="mx-auto max-w-[680px] px-[22px]">
        <div className="relative flex flex-wrap items-end justify-between gap-6 border-t-4 border-navy pt-8">
          <div>
            <p className="text-[34px] font-extrabold leading-none tracking-[-0.05em] text-navy sm:text-[40px]">Thanks for reading.</p>
            <p className="mt-4 text-[15px] font-bold text-body">Written by</p>
            <p className="text-[20px] font-extrabold tracking-[-0.03em] text-navy">{post.author}</p>
            <p className="mt-1 text-[14px] text-body">Published {date}</p>
          </div>
          <Stamp title="THE END" sub="THE BRIDGE" tone="blue" tilt={-8} />
        </div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${post.title} https://www.medicconnect.co/blog/${post.slug}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex min-h-[48px] items-center gap-3 border-2 border-navy bg-white px-5 text-[16px] font-extrabold text-navy shadow-offset-sm hover:bg-tint"
        >
          Share on WhatsApp
          <Chevrons size={13} colors={["hsl(var(--brand))", "hsl(var(--brand))", "hsl(var(--navy))"]} />
        </a>
        <div className="relative mt-10 overflow-hidden bg-navy p-6 pr-[120px] shadow-offset-blue sm:p-8 sm:pr-[180px]">
          <img src={art.charNurse} alt="" className="pointer-events-none absolute -bottom-2 right-2 h-[150px] object-contain sm:right-6 sm:h-[190px]" />
          <p className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.04em] text-white sm:text-[28px]">Need care at home?</p>
          <p className="mt-2 text-[15px] leading-[1.6] text-body-navy">Tell us what is needed and we will arrange the assessment.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <CareRequestDialog
              source={`blog:${post.slug}`}
              trigger={
                <button className="inline-flex min-h-[48px] items-center justify-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy">
                  Request care
                </button>
              }
            />
            <a
              href="https://wa.me/2348126988237"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-control border-2 border-white/40 px-6 text-[16px] font-extrabold text-white hover:bg-white/10"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {relatedPosts.length > 0 && (
        <section aria-labelledby="related-heading" className="mx-auto mt-20 max-w-[1440px] px-[22px] sm:px-[50px]">
          <hr className="mb-6 border-t-4 border-navy" />
          <p className="eyebrow">Keep reading</p>
          <h2 id="related-heading" className="mt-3 text-[30px] leading-none tracking-[-0.05em] sm:text-[40px]">
            More from The Bridge
          </h2>
          <ul className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {relatedPosts.map((rp, i) => (
              <li key={rp.slug}>
                <PostCard post={rp} index={i} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mx-auto max-w-[1440px] px-[22px] pb-16 pt-12 sm:px-[50px]">
        <Link to="/blog" className="text-[16px] font-extrabold text-brand hover:text-navy">
          <span aria-hidden="true">←</span> All stories
        </Link>
      </div>

      <Footer />
    </div>
  );
};

export default BlogPost;
