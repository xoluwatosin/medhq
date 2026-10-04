import { Tape } from "@/components/mc/brand";
import { splitContentAtH2, renderSection } from "./contentUtils";

/** A photo in the story, taped down as a print. */
const Print = ({ src, tilt }: { src: string; tilt: number }) => (
  <figure style={{ transform: `rotate(${tilt}deg)` }} className="relative my-12 border-2 border-navy bg-white p-2.5 pb-3 shadow-offset sm:p-3">
    <Tape width={110} tilt={-tilt * 2} className="-top-3 left-1/2 z-10 -ml-[55px]" />
    <img loading="lazy" decoding="async" src={src} alt="" className="w-full object-cover" />
  </figure>
);

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const CleanEditorial = ({ content, bodyImages, dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);

  return (
    <article className="mx-auto max-w-[680px] px-[22px] pt-4 pb-12 text-[17px] leading-[1.75] text-ink sm:text-[18.5px]">
      {sections.map((section, i) => (
        <div key={i}>
          {renderSection(section, i, i === 0, dropCapEnabled)}
          {i === 0 && bodyImages[0] && (
            <Print src={bodyImages[0]} tilt={-1.5} />
          )}
          {i === Math.floor(sections.length / 2) && bodyImages[1] && (
            <Print src={bodyImages[1]} tilt={1.2} />
          )}
        </div>
      ))}
      {bodyImages[2] && (
        <Print src={bodyImages[2]} tilt={-1} />
      )}
    </article>
  );
};

export default CleanEditorial;
