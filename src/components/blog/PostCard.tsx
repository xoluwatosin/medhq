import { Link } from "react-router-dom";
import blogPlaceholder from "@/assets/photos/about-moment.webp";
import { cn } from "@/lib/utils";

export interface PostCardData {
  title: string;
  slug: string;
  excerpt?: string;
  category: string;
  author?: string;
  featured_image_url: string | null;
  published_at: string;
}

export const postDate = (iso: string, month: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month, year: "numeric" });

/** The first paragraph of an excerpt; some excerpts carry several. */
export const firstParagraph = (text?: string) => (text || "").split(/\n\s*\n/)[0].trim();

const TILTS = [-0.6, 0.5, -0.4];

/** A story in the grid: square photo, category, title, then who and when. */
const PostCard = ({ post, index = 0 }: { post: PostCardData; index?: number }) => (
  <Link
    to={`/blog/${post.slug}`}
    style={{ ["--mc-tilt" as string]: `${TILTS[index % TILTS.length]}deg` }}
    className="mc-tilt group flex h-full flex-col border-2 border-navy bg-white shadow-offset transition-colors hover:bg-tint"
  >
    <div className="aspect-[16/10] overflow-hidden border-b-2 border-navy">
      <img
        loading="lazy"
        decoding="async"
        src={post.featured_image_url || blogPlaceholder}
        alt=""
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
    <div className="flex flex-1 flex-col gap-2 p-5">
      {post.category && <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand">{post.category}</p>}
      <h3 className="line-clamp-3 text-[20px] leading-[1.15] tracking-[-0.03em] text-navy">{post.title}</h3>
      <p className={cn("mt-auto pt-3 text-[13.5px] font-bold text-body")}>
        {post.author ? `${post.author}, ` : ""}
        {postDate(post.published_at)}
      </p>
    </div>
  </Link>
);

export default PostCard;
