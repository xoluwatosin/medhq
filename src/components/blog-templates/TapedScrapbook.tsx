import { splitContentAtH2, renderSection, PolaroidFrame } from "./contentUtils";

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const TapedScrapbook = ({ content, bodyImages, bodyCaptions = [], dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);

  return (
    <article className="max-w-[820px] mx-auto px-[22px] pt-0 pb-12 text-[17px] leading-[1.75] text-ink sm:text-[18.5px]">
      {sections.map((s, i) => (
        <div key={i}>
          {renderSection(s, i, i === 0, dropCapEnabled)}
          {bodyImages[i] && (
            <div className="flex justify-center my-8">
              <PolaroidFrame
                src={bodyImages[i]}
                caption={bodyCaptions[i]}
                rotation={i % 2 === 0 ? -3 : 3}
                variant="tape"
                className="w-72"
              />
            </div>
          )}
        </div>
      ))}
    </article>
  );
};

export default TapedScrapbook;
