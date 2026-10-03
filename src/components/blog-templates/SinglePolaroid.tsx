import { splitContentAtH2, renderSection, PolaroidFrame } from "./contentUtils";

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const SinglePolaroid = ({ content, bodyImages, bodyCaptions = [], dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);
  const midpoint = Math.floor(sections.length / 2);

  return (
    <article className="max-w-[820px] mx-auto px-4 pt-0 pb-12 text-lg leading-relaxed">
      {sections.slice(0, midpoint).map((s, i) => renderSection(s, i, i === 0, dropCapEnabled))}
      {bodyImages[0] && (
        <div className="flex justify-center my-10">
          <PolaroidFrame src={bodyImages[0]} caption={bodyCaptions[0] || "A moment captured"} rotation={-2} variant="tape" className="max-w-sm" />
        </div>
      )}
      {sections.slice(midpoint).map((s, i) => renderSection(s, midpoint + i))}
    </article>
  );
};

export default SinglePolaroid;
