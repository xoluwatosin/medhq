import { splitContentAtH2, renderSection, PolaroidFrame } from "./contentUtils";

interface Props {
  content: string;
  bodyImages: string[];
  bodyCaptions?: string[];
  dropCapEnabled?: boolean;
}

const ClotheslineGallery = ({ content, bodyImages, bodyCaptions = [], dropCapEnabled = true }: Props) => {
  const sections = splitContentAtH2(content);
  const midpoint = Math.floor(sections.length / 2);
  const images = bodyImages.filter(url => url).slice(0, 5);

  return (
    <article className="max-w-[900px] mx-auto px-4 pt-0 pb-12 text-lg leading-relaxed">
      {sections.slice(0, midpoint).map((s, i) => renderSection(s, i, i === 0, dropCapEnabled))}
      {images.length > 0 && (
        <div className="relative my-12">
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-muted-foreground/30" style={{ zIndex: 0 }} />
          <div className="flex justify-center gap-4 flex-wrap relative" style={{ zIndex: 1 }}>
            {images.map((url, i) => (
              <PolaroidFrame key={i} src={url} caption={bodyCaptions[i] || undefined} rotation={[-5, 3, -2, 4, -1][i]} variant="pin" className="w-40" />
            ))}
          </div>
        </div>
      )}
      {sections.slice(midpoint).map((s, i) => renderSection(s, midpoint + i))}
    </article>
  );
};

export default ClotheslineGallery;
