import { splitContentAtH2, renderSection, PolaroidFrame } from "./contentUtils";

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const PolaroidPair = ({ content, bodyImages, bodyCaptions = [], dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);
  const midpoint = Math.floor(sections.length / 2);

  return (
    <article className="max-w-[820px] mx-auto px-4 pt-0 pb-12 text-lg leading-relaxed">
      {sections.slice(0, midpoint).map((s, i) => renderSection(s, i, i === 0, dropCapEnabled))}
      {(bodyImages[0] || bodyImages[1]) && (
        <div className="flex flex-wrap justify-center gap-8 my-10">
          {bodyImages[0] && <PolaroidFrame src={bodyImages[0]} caption={bodyCaptions[0]} rotation={-3} variant="tape" className="w-64" />}
          {bodyImages[1] && <PolaroidFrame src={bodyImages[1]} caption={bodyCaptions[1]} rotation={2} variant="pin" className="w-64" />}
        </div>
      )}
      {sections.slice(midpoint).map((s, i) => renderSection(s, midpoint + i))}
    </article>
  );
};

export default PolaroidPair;
