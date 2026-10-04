import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { KitMain } from "@/components/kit/KitLayout";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import PostCard, { firstParagraph, postDate, type PostCardData } from "@/components/blog/PostCard";
import blogPlaceholder from "@/assets/photos/about-moment.webp";
import { cn } from "@/lib/utils";

interface PostRow extends PostCardData {
  id: string;
}

/**
 * The Bridge: the newest story set large beside its photo, then the rest as
 * cards, with the categories as tags to filter by. Phones get one column and
 * a sideways row of tags.
 */
const Blog = () => {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, category, author, featured_image_url, published_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts(data || []);
        setLoading(false);
      });
  }, []);

  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];
  const filtered = activeCategory ? posts.filter((p) => p.category === activeCategory) : posts;
  const [lead, ...rest] = filtered;

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-[40px] shrink-0 whitespace-nowrap border-2 px-4 text-[14px] font-extrabold transition-colors",
        active ? "border-navy bg-navy text-white" : "border-navy/20 bg-white text-navy hover:border-navy",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="The Bridge | Medic Connect"
        description="Stories, insights and field notes on caring well, at home and in hospital, from the Medic Connect team."
        path="/blog"
      />
      <MedicHeader />

      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
        <Watermark glyph="o" size={620} opacity={0.12} className="-right-[200px] -top-[120px] hidden lg:block" />
        <Watermark glyph="o" size={300} opacity={0.12} className="-right-[90px] -top-[30px] lg:hidden" />
        <div className="relative mx-auto max-w-[1440px] px-[22px] pb-14 sm:px-[50px] lg:pb-20">
          <div className="max-w-[60%] lg:max-w-[720px]">
            <p className="eyebrow !text-brand-soft">Stories from Medic Connect</p>
            <div className="mt-3 lg:mt-4">
              <KitPillHeading text="The Bridge" accent={[1]} align="left" />
            </div>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.55] text-body-navy sm:text-[18px] lg:mt-6 lg:text-[19px]">
              Stories, insights and field notes from nurses, carers and families, at home and in hospital.
            </p>
          </div>
          <img
            src={art.nurseFilmingExplainer}
            alt=""
            className="pointer-events-none absolute bottom-0 right-3 h-[190px] max-w-[38%] object-contain object-right-bottom sm:right-[40px] sm:h-[240px] lg:right-[120px] lg:h-[300px]"
          />
        </div>
      </section>

      <KitMain className="pt-10 lg:pt-14">
        {categories.length > 0 && (
          <div role="group" aria-label="Filter by topic" className="-mx-[22px] flex gap-2 overflow-x-auto px-[22px] pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {chip("All stories", !activeCategory, () => setActiveCategory(null))}
            {categories.map((cat) => chip(cat, activeCategory === cat, () => setActiveCategory(cat)))}
          </div>
        )}

        {loading ? (
          <div aria-busy="true" aria-label="Loading stories" className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div className="aspect-[4/3] animate-pulse bg-tint" />
            <div className="space-y-4 pt-4">
              <div className="h-4 w-32 animate-pulse bg-tint" />
              <div className="h-10 w-full animate-pulse bg-tint" />
              <div className="h-10 w-3/4 animate-pulse bg-tint" />
              <div className="h-20 w-full animate-pulse bg-tint" />
            </div>
          </div>
        ) : !lead ? (
          <div className="mt-10 flex flex-col items-center gap-4 border-2 border-navy bg-tint px-6 py-14 text-center">
            <img src={art.objPhoneChat} alt="" className="h-[120px] object-contain" />
            <p className="text-[22px] font-extrabold tracking-[-0.03em] text-navy">New stories are on their way.</p>
            <p className="text-[15.5px] text-body">Check back soon.</p>
          </div>
        ) : (
          <>
            {/* The newest story, set large. */}
            <Link to={`/blog/${lead.slug}`} className="group mt-10 grid items-center gap-8 lg:mt-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
              <figure className="relative w-full rotate-[-1.5deg] bg-white p-3 pb-4 shadow-offset">
                <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[3deg] bg-tint-deep/80" />
                <img src={lead.featured_image_url || blogPlaceholder} alt="" className="aspect-[16/10] w-full object-cover" />
              </figure>
              <div>
                <NotchTag tone="blue" size="sm">
                  {lead.category || "Latest"}
                </NotchTag>
                <h2 className="mt-4 text-[30px] leading-[1.05] tracking-[-0.05em] text-navy group-hover:text-brand sm:text-[42px]">{lead.title}</h2>
                {firstParagraph(lead.excerpt) && (
                  <p className="mt-4 line-clamp-4 max-w-[56ch] text-[16.5px] leading-[1.65] text-body sm:text-[18px]">{firstParagraph(lead.excerpt)}</p>
                )}
                <p className="mt-5 text-[14px] font-bold text-body">
                  {lead.author ? `${lead.author}, ` : ""}
                  {postDate(lead.published_at, "long")}
                </p>
                <span className="mt-5 inline-block text-[16px] font-extrabold text-brand group-hover:text-navy">
                  Read the story <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>

            {rest.length > 0 && (
              <section aria-labelledby="more-heading" className="mt-20 lg:mt-24">
                <hr className="mb-6 border-t-4 border-navy" />
                <h2 id="more-heading" className="text-[30px] leading-none tracking-[-0.05em] sm:text-[40px]">
                  {activeCategory ?? "More stories"}
                </h2>
                <ul className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                  {rest.map((post, i) => (
                    <li key={post.id}>
                      <PostCard post={post} index={i} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <div className="hidden lg:block">
          <CTASection headline="Need care at home?" body="Tell us what is needed and we will arrange the assessment." />
        </div>
      </KitMain>
      <Footer />
    </div>
  );
};

export default Blog;
