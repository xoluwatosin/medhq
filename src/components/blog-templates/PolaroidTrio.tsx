import { splitContentAtH2, renderSection, PolaroidFrame } from "./contentUtils";

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const PolaroidTrio = ({ content, bodyImages, bodyCaptions = [], dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);
  const midpoint = Math.floor(sections.length / 2);
  const activeImages = bodyImages.filter(url => url).slice(0, 3);

  return (
    <article className="max-w-[820px] mx-auto px-4 pt-0 pb-12 text-lg leading-relaxed">
      {sections.slice(0, midpoint).map((s, i) => renderSection(s, i, i === 0, dropCapEnabled))}
      {activeImages.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6 my-10">
          {activeImages.map((url, i) => (
            <PolaroidFrame key={i} src={url} caption={bodyCaptions[i]} rotation={[-4, 1, 3][i]} variant={["tape", "pin", "tape"][i] as "tape" | "pin"} className="w-52" />
          ))}
        </div>
      )}
      {sections.slice(midpoint).map((s, i) => renderSection(s, midpoint + i))}
    </article>
  );
};

export default PolaroidTrio;
