import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import { Loader2 } from "lucide-react";
import blogPlaceholder from "@/assets/hero/clinical-hero.jpg";
import AudienceHero from "@/components/home/AudienceHero";
import KitPillHeading from "@/components/kit/KitPillHeading";

interface PostCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  featured_image_url: string | null;
  published_at: string;
}

const truncateWords = (text: string, maxWords: number) => {
  const words = (text || "").split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
};

const Blog = () => {
  const [posts, setPosts] = useState<PostCard[]>([]);
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

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title="The Bridge | Medic Connect"
        description="Stories, insights, and updates on healthcare, caregiving, and the Care Operating System from the Medic Connect team."
        path="/blog"
      />
      <MedicHeader />
      <main>
        <AudienceHero>
          <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-[0.24em] text-body-navy">
            The Care Operating System
          </p>
          <KitPillHeading text="The Bridge" accent={[1]} align="centre" />
          <p className="mx-auto mt-6 max-w-2xl text-center text-[15px] leading-relaxed text-body-navy sm:text-base">
            Stories, insights and field notes on caring well, at home and in hospital.
          </p>
        </AudienceHero>

        <section className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Category pills */}
            {categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`kit-curve-sm border px-4 py-1.5 text-sm font-medium transition-colors ${!activeCategory ? "border-brand bg-brand text-white" : "border-hairline bg-card text-foreground hover:bg-muted"}`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`kit-curve-sm border px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat ? "border-brand bg-brand text-white" : "border-hairline bg-card text-foreground hover:bg-muted"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No posts yet. Check back soon!</p>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
                    <div className="kit-curve overflow-hidden border border-hairline bg-card transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">

                      <div className="aspect-[16/10] overflow-hidden">
                        <img loading="lazy" decoding="async"
                          src={post.featured_image_url || blogPlaceholder}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-5 h-[180px] flex flex-col overflow-hidden">
                        {post.category && (
                          <span className="text-xs font-medium uppercase tracking-wider text-primary shrink-0">{post.category}</span>
                        )}
                        <h2 className="text-lg font-semibold mt-1 mb-2 group-hover:text-primary transition-colors line-clamp-2 shrink-0">
                          {post.title}
                        </h2>
                        <p className="text-sm text-muted-foreground line-clamp-2 shrink-0">{truncateWords(post.excerpt || "", 12)}</p>
                        <p className="text-xs text-muted-foreground mt-auto pt-3">
                          {post.author}, {new Date(post.published_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
