import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { postImage, type PostCardData } from "./PostCard";

const TILTS = [-6, 4, -3, 5];

/**
 * The newest stories pegged to a line across the hero, like prints drying.
 * While stories load, empty frames hang in their place.
 */
const Clothesline = ({ posts, loading, className }: { posts: PostCardData[]; loading: boolean; className?: string }) => {
  const frames = loading ? [null, null, null] : posts.slice(0, 3);
  if (!loading && frames.length === 0) return null;
  return (
    <div className={cn("relative", className)}>
      {/* The line sags a little between its ends. */}
      <svg aria-hidden="true" viewBox="0 0 600 40" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-10 w-full">
        <path d="M0 6 Q300 40 600 6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <ul className="relative flex justify-around gap-3 px-2 pt-3">
        {frames.map((post, i) => (
          <li key={post?.slug ?? i} className={cn("flex flex-col items-center", i === 1 && "pt-4")}>
            <span aria-hidden="true" className="relative z-10 -mb-2 h-6 w-2.5 bg-brand-soft shadow-[2px_2px_0_rgba(0,0,0,0.25)]" />
            {post ? (
              <Link
                to={`/blog/${post.slug}`}
                aria-label={post.title}
                style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg`, transformOrigin: "top center" }}
                className="mc-tilt block w-[96px] bg-white p-1.5 pb-5 shadow-[6px_6px_0_rgba(0,0,0,0.25)] sm:w-[150px] sm:p-2 sm:pb-7"
              >
                <img src={postImage(post.featured_image_url)} alt="" className="aspect-square w-full object-cover" />
              </Link>
            ) : (
              <span
                style={{ transform: `rotate(${TILTS[i]}deg)`, transformOrigin: "top center" }}
                className="block w-[96px] bg-white p-1.5 pb-5 sm:w-[150px] sm:p-2 sm:pb-7"
              >
                <span className="block aspect-square w-full animate-pulse bg-tint" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Clothesline;
