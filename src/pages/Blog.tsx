import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { KitMain } from "@/components/kit/KitLayout";
import { Chevrons, PillSticker, SpeechBubble, Stamp, Tape, TapeLabel, Watermark } from "@/components/mc/brand";
import { art } from "@/components/mc/art";
import PostCard, { firstParagraph, postDate, postImage, type PostCardData } from "@/components/blog/PostCard";
import { cn } from "@/lib/utils";

interface PostRow extends PostCardData {
  id: string;
}

const TAG_TILTS = [-2, 1.5, -1, 2, -1.5, 1];

/** An open invitation pinned to the board: ask us what to write about next. */
const Invite = () => (
  <div className="relative flex h-full rotate-[1.2deg] flex-col items-start gap-4 bg-tint p-5 pt-8 shadow-offset">
    <span aria-hidden="true" className="absolute left-1/2 -top-2 -ml-2 h-4 w-4 bg-brand shadow-[2px_2px_0_hsl(var(--navy))]" />
    <SpeechBubble side="left" tone="navy" className="!max-w-none text-[19px] sm:text-[20px]">
      Is there something you would like us to write about?
    </SpeechBubble>
    <a
      href={`https://wa.me/2348126988237?text=${encodeURIComponent("Hello Medic Connect, I have an idea for The Bridge: ")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[48px] items-center gap-3 border-2 border-navy bg-white px-5 text-[16px] font-extrabold text-navy shadow-offset-sm hover:bg-tint"
    >
      Tell us on WhatsApp
      <Chevrons size={13} colors={["hsl(var(--brand))", "hsl(var(--brand))", "hsl(var(--navy))"]} />
    </a>
    <img src={art.nurseFilmingExplainer} alt="" className="mt-auto h-[170px] self-end object-contain" />
  </div>
);

/**
 * The Bridge, set out like a scrapbook: the newest stories pegged to a line
 * across the hero, topics as strips of tape, the latest story stamped, and the
 * rest as polaroids taped or pinned to the board.
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

  const tag = (label: string, active: boolean, onClick: () => void, i: number) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{ transform: `rotate(${TAG_TILTS[i % TAG_TILTS.length]}deg)` }}
      className={cn(
        "min-h-[40px] shrink-0 whitespace-nowrap px-4 text-[13px] font-extrabold uppercase tracking-[0.12em] transition-colors",
        active ? "bg-brand text-white shadow-offset-sm" : "bg-tint-deep/70 text-navy hover:bg-tint-deep",
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
          <p className="eyebrow !text-brand-soft">Stories from Medic Connect</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4 lg:mt-6">
            <KitPillHeading text="The Bridge" accent={[1]} align="left" size="xl" />
            {posts.length > 0 && (
              <PillSticker tone="blue" tilt={-6} className="mb-2">
                {posts.length} {posts.length === 1 ? "story" : "stories"} so far
              </PillSticker>
            )}
          </div>
          <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.55] text-body-navy sm:text-[19px] lg:mt-8 lg:text-[21px]">
            Stories, insights and field notes from nurses, carers and families, at home and in hospital.
          </p>
        </div>
      </section>

      <KitMain className="pt-10 lg:pt-14">
        {categories.length > 0 && (
          <div role="group" aria-label="Filter by topic" className="-mx-[22px] flex gap-3 overflow-x-auto px-[22px] py-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {tag("All stories", !activeCategory, () => setActiveCategory(null), 0)}
            {categories.map((cat, i) => tag(cat, activeCategory === cat, () => setActiveCategory(cat), i + 1))}
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
            {/* The newest story, set large and stamped. */}
            <Link to={`/blog/${lead.slug}`} className="group mt-12 grid items-center gap-10 lg:mt-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
              <figure className="relative w-full rotate-[-1.5deg] border-2 border-navy bg-white p-3 pb-12 shadow-offset transition-transform group-hover:rotate-0 sm:p-4 sm:pb-14">
                <Tape width={130} tilt={-3} className="-top-3 left-1/2 z-10 -ml-[65px]" />
                <img src={postImage(lead.featured_image_url)} alt="" className="aspect-[16/10] w-full object-cover" />
                <figcaption className="absolute bottom-3 left-4 text-[14px] font-extrabold text-navy sm:bottom-4 sm:left-5 sm:text-[15px]">
                  {postDate(lead.published_at, "long")}
                </figcaption>
                <Stamp title="NEW" sub="ON THE BRIDGE" tone="blue" tilt={10} className="absolute -right-3 -top-5 bg-white sm:-right-6 sm:-top-7" />
              </figure>
              <div>
                <TapeLabel tone="blue" tilt={-2} className="uppercase">
                  {lead.category || "Latest"}
                </TapeLabel>
                <h2 className="mt-5 text-[30px] leading-[1.05] tracking-[-0.05em] text-navy group-hover:text-brand sm:text-[42px]">{lead.title}</h2>
                {firstParagraph(lead.excerpt) && (
                  <p className="mt-4 line-clamp-4 max-w-[56ch] text-[16.5px] leading-[1.65] text-body sm:text-[18px]">{firstParagraph(lead.excerpt)}</p>
                )}
                {lead.author && <p className="mt-5 text-[14px] font-bold text-body">By {lead.author}</p>}
                <span className="mt-6 inline-flex min-h-[48px] items-center gap-3 bg-navy px-6 text-[16px] font-extrabold text-white shadow-offset-blue group-hover:bg-brand">
                  Read the story
                  <Chevrons size={13} />
                </span>
              </div>
            </Link>

            {rest.length > 0 && (
              <section aria-labelledby="more-heading" className="mt-20 lg:mt-24">
                <hr className="mb-6 border-t-4 border-navy" />
                <h2 id="more-heading" className="text-[30px] leading-none tracking-[-0.05em] sm:text-[40px]">
                  {activeCategory ?? "More from the board"}
                </h2>
                <ul className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post, i) => (
                    <li key={post.id}>
                      <PostCard post={post} index={i} />
                    </li>
                  ))}
                  <li>
                    <Invite />
                  </li>
                </ul>
              </section>
            )}
          </>
        )}

        {/* With no grid to sit in, the invitation stands on its own. */}
        {!loading && rest.length === 0 && (
          <div className="mx-auto mt-20 max-w-[420px] lg:mt-24">
            <Invite />
          </div>
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
