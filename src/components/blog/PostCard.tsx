import { Link } from "react-router-dom";
import blogPlaceholder from "@/assets/photos/about-moment.webp";
import { Tape, TapeLabel } from "@/components/mc/brand";
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

/**
 * A description short enough for search results and link previews (about 155
 * characters): whole sentences while they fit, otherwise cut at a word.
 */
export const shareDescription = (text: string, max = 155) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim().length >= 70) return out.trim();
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
};

/** Minutes to read, at an easy 220 words a minute. */
export const readMinutes = (content: string) => Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 220));

export const postImage = (url: string | null) => url || blogPlaceholder;

const TILTS = [-2, 1.6, -1.2, 2.2, -1.6, 1];

/** A square pin, the board's other fixing besides tape. */
export const Pin = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn("absolute z-10 h-4 w-4 bg-brand shadow-[2px_2px_0_hsl(var(--navy))]", className)} />
);

/**
 * A story as a polaroid on the board: taped or pinned in turn, tilted, with
 * its topic on a strip of tape across the photo. Straightens under the pointer.
 */
const PostCard = ({ post, index = 0 }: { post: PostCardData; index?: number }) => (
  <Link
    to={`/blog/${post.slug}`}
    style={{ ["--mc-tilt" as string]: `${TILTS[index % TILTS.length]}deg` }}
    className="mc-tilt group relative flex h-full flex-col border-2 border-navy bg-white p-3 pb-5 shadow-offset transition-colors hover:bg-tint"
  >
    {index % 2 ? <Pin className="left-1/2 -top-2 -ml-2" /> : <Tape width={86} tilt={index % 4 ? 4 : -4} className="-top-3 left-1/2 z-10 -ml-[43px]" />}
    <div className="relative">
      <img
        loading="lazy"
        decoding="async"
        src={postImage(post.featured_image_url)}
        alt=""
        className="aspect-[4/3] w-full object-cover"
      />
      {post.category && (
        <TapeLabel tone={index % 3 === 1 ? "navy" : index % 3 === 2 ? "tint" : "blue"} tilt={index % 2 ? 2 : -2} className="absolute -bottom-3 left-3 !text-[11px] uppercase">
          {post.category}
        </TapeLabel>
      )}
    </div>
    <div className="flex flex-1 flex-col gap-2 px-1 pt-6">
      <h3 className="line-clamp-3 text-[20px] leading-[1.15] tracking-[-0.03em] text-navy group-hover:text-brand">{post.title}</h3>
      <p className="mt-auto pt-2 text-[13.5px] font-bold text-body">
        {post.author ? `${post.author}, ` : ""}
        {postDate(post.published_at)}
      </p>
    </div>
  </Link>
);

export default PostCard;
