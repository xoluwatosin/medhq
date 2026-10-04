import React from "react";

interface PolaroidFrameProps {
  src: string;
  caption?: string;
  rotation?: number;
  variant?: "tape" | "pin" | "plain";
  className?: string;
}

const PolaroidFrame: React.FC<PolaroidFrameProps> = ({
  src, caption, rotation = 0, variant = "plain", className = "",
}) => {
  if (!src) return null;
  return (
    <div
      className={`relative inline-block bg-white p-3 pb-12 shadow-offset ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {variant === "tape" && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-tint-deep/80 rotate-[-2deg]" />
      )}
      {variant === "pin" && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand" />
      )}
      <img loading="lazy" decoding="async" src={src} alt={caption || ""} className="w-full aspect-square object-cover" />
      {caption && (
        <p className="text-center mt-2 font-handwritten text-lg text-navy">{caption}</p>
      )}
    </div>
  );
};

export { PolaroidFrame };
export type { PolaroidFrameProps };
