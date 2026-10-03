import { splitContentAtH2, renderSection, PolaroidFrame } from "./contentUtils";

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const StackedPolaroids = ({ content, bodyImages, bodyCaptions = [], dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);
  const midpoint = Math.floor(sections.length / 2);
  const activeImages = bodyImages.filter(url => url);

  return (
    <article className="max-w-[900px] mx-auto px-4 pt-0 pb-12 text-lg leading-relaxed">
      {sections.slice(0, midpoint).map((s, i) => renderSection(s, i, i === 0, dropCapEnabled))}
      {activeImages.length > 0 && (
        <div className="space-y-10 my-10">
          {Array.from({ length: Math.ceil(activeImages.length / 2) }, (_, pairIdx) => (
            <div key={pairIdx} className="flex justify-center gap-4 sm:gap-6">
              {activeImages.slice(pairIdx * 2, pairIdx * 2 + 2).map((url, i) => {
                const idx = pairIdx * 2 + i;
                return (
                  <PolaroidFrame
                    key={idx}
                    src={url}
                    caption={bodyCaptions[idx]}
                    rotation={[3, -5, 2, -3, 4, -1][idx % 6]}
                    variant={idx % 3 === 0 ? "tape" : "plain"}
                    className="w-[42vw] sm:w-64"
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
      {sections.slice(midpoint).map((s, i) => renderSection(s, midpoint + i))}
    </article>
  );
};

export default StackedPolaroids;
