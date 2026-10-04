import heardMark from "@/assets/heard/heard-mark-primary.svg";

/**
 * The full Heard logo lockup: wordmark plus the infinity.
 * The infinity is the star of the lockup, never the whole logo on its own.
 * HeardMark stays available separately for watermarks and section marks.
 */
export const HeardLogo = ({
  size = "md",
  showSubline = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  showSubline?: boolean;
  className?: string;
}) => {
  const mark = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const word = size === "lg" ? "text-[30px]" : size === "sm" ? "text-[19px]" : "text-[24px]";
  return (
    <span className={`hv-logo ${className}`}>
      <img src={heardMark} className={`${mark} shrink-0`} alt="" />
      <span className="flex flex-col">
        <span className={`hv-logo-word ${word}`}>Heard</span>
        {showSubline && <span className="hv-logo-sub">by Medic Connect</span>}
      </span>
    </span>
  );
};

export default HeardLogo;
