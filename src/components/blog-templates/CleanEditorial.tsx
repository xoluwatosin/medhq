import { splitContentAtH2, renderSection } from "./contentUtils";

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
            <img loading="lazy" decoding="async" src={bodyImages[0]} alt="" className="my-10 w-full border-2 border-navy object-cover" />
          )}
          {i === Math.floor(sections.length / 2) && bodyImages[1] && (
            <img loading="lazy" decoding="async" src={bodyImages[1]} alt="" className="my-10 w-full border-2 border-navy object-cover" />
          )}
        </div>
      ))}
      {bodyImages[2] && (
        <img loading="lazy" decoding="async" src={bodyImages[2]} alt="" className="my-10 w-full border-2 border-navy object-cover" />
      )}
    </article>
  );
};

export default CleanEditorial;
