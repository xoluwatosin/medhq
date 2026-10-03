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
    <article className="max-w-[680px] mx-auto px-5 sm:px-6 pt-4 pb-12 font-serif text-[1.125rem] sm:text-[1.1875rem] leading-[1.75] text-foreground/90">
      {sections.map((section, i) => (
        <div key={i}>
          {renderSection(section, i, i === 0, dropCapEnabled)}
          {i === 0 && bodyImages[0] && (
            <img loading="lazy" decoding="async" src={bodyImages[0]} alt="" className="rounded-xl my-10 w-full object-cover" />
          )}
          {i === Math.floor(sections.length / 2) && bodyImages[1] && (
            <img loading="lazy" decoding="async" src={bodyImages[1]} alt="" className="rounded-xl my-10 w-full object-cover" />
          )}
        </div>
      ))}
      {bodyImages[2] && (
        <img loading="lazy" decoding="async" src={bodyImages[2]} alt="" className="rounded-xl my-10 w-full object-cover" />
      )}
    </article>
  );
};

export default CleanEditorial;
