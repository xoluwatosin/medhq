interface KitPillHeadingProps {
  /** The full heading, read by screen readers and search engines. */
  text: string;
  /** Zero based indices of the words that sit in a solid brand pill. */
  accent?: number[];
  /** Centre the pills instead of aligning them left. */
  align?: "left" | "centre";
  className?: string;
}

/**
 * The house headline treatment: each word sits in its own kit-curve pill,
 * outlined by default with selected words filled in brand blue.
 * Used on navy heroes, so the type is always white.
 */
const KitPillHeading = ({ text, accent = [], align = "centre", className = "" }: KitPillHeadingProps) => {
  const words = text.split(" ").filter(Boolean);

  return (
    <h1 className={`block ${className}`}>
      <span className="sr-only">{text}</span>
      <span
        aria-hidden="true"
        className={`flex flex-wrap items-center gap-2 sm:gap-3 ${
          align === "centre" ? "justify-center" : "justify-start"
        }`}
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            tabIndex={0}
            style={{
              // Uneven delays and durations so the row drifts spontaneously
              // rather than marching in time.
              ["--kit-pill-delay" as string]: `${((index * 0.73) % 2.4).toFixed(2)}s`,
              ["--kit-pill-dur" as string]: `${(5.2 + ((index * 0.41) % 1.8)).toFixed(2)}s`,
            }}
            className={
              accent.includes(index)
                ? "kit-pill kit-curve-sm sm:kit-curve inline-block cursor-default bg-brand px-3 py-1.5 text-[30px] font-medium leading-[1.05] tracking-[-0.03em] text-white outline-none sm:px-6 sm:py-3 sm:text-[54px]"
                : "kit-pill kit-curve-sm sm:kit-curve inline-block cursor-default border-[1.5px] border-outline-navy px-3 py-1.5 text-[30px] font-medium leading-[1.05] tracking-[-0.03em] text-white outline-none transition-colors duration-300 hover:bg-white/5 sm:px-6 sm:py-3 sm:text-[54px]"
            }
          >
            {word}
          </span>
        ))}

      </span>
    </h1>
  );
};

export default KitPillHeading;
