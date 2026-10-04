interface KitPillHeadingProps {
  /** The full heading, read by screen readers and search engines. */
  text: string;
  /** Zero based indices of the words that sit in a solid brand block. */
  accent?: number[];
  /** Centre the blocks instead of aligning them left. */
  align?: "left" | "centre";
  className?: string;
}

/**
 * The house headline treatment on navy heroes: each word sits in its own
 * square block, tilted a touch in alternating directions like cards dropped on
 * a table. Outlined by default, accent words filled in brand blue with a hard
 * white offset. Blocks straighten under the pointer. Type is always white.
 */
const TILTS = [-1.5, 1.2, -0.8, 1.6, -1.2, 0.8];

const KitPillHeading = ({ text, accent = [], align = "centre", className = "" }: KitPillHeadingProps) => {
  const words = text.split(" ").filter(Boolean);

  return (
    <h1 className={`block ${className}`}>
      <span className="sr-only">{text}</span>
      <span
        aria-hidden="true"
        className={`flex flex-wrap items-center gap-2.5 sm:gap-3.5 ${
          align === "centre" ? "justify-center" : "justify-start"
        }`}
      >
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            style={{ ["--mc-tilt" as string]: `${TILTS[index % TILTS.length]}deg` }}
            className={
              accent.includes(index)
                ? "mc-tilt inline-block cursor-default bg-brand px-3 py-1.5 text-[30px] font-extrabold leading-[1.05] tracking-[-0.05em] text-white shadow-[4px_4px_0_#fff] sm:px-6 sm:py-3 sm:text-[54px] sm:shadow-[6px_6px_0_#fff]"
                : "mc-tilt inline-block cursor-default border-2 border-outline-navy px-3 py-1.5 text-[30px] font-extrabold leading-[1.05] tracking-[-0.05em] text-white sm:px-6 sm:py-3 sm:text-[54px]"
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
