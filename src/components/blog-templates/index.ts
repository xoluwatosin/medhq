import React from "react";
import CleanEditorial from "./CleanEditorial";
import SinglePolaroid from "./SinglePolaroid";
import PolaroidPair from "./PolaroidPair";
import PolaroidTrio from "./PolaroidTrio";
import ClotheslineGallery from "./ClotheslineGallery";
import TapedScrapbook from "./TapedScrapbook";
import StackedPolaroids from "./StackedPolaroids";
import MixedEditorial from "./MixedEditorial";

export { PolaroidFrame } from "./PolaroidFrame";
export { splitContentAtH2, renderSection } from "./contentUtils";
export { CleanEditorial, SinglePolaroid, PolaroidPair, PolaroidTrio, ClotheslineGallery, TapedScrapbook, StackedPolaroids, MixedEditorial };

export const TEMPLATE_META = [
  { value: "clean-editorial", label: "Clean Editorial", slots: ["Hero image", "Mid-article image", "End image"] },
  { value: "single-polaroid", label: "Single Polaroid", slots: ["Featured polaroid"] },
  { value: "polaroid-pair", label: "Polaroid Pair", slots: ["Polaroid left", "Polaroid right"] },
  { value: "polaroid-trio", label: "Polaroid Trio", slots: ["Polaroid 1", "Polaroid 2", "Polaroid 3"] },
  { value: "clothesline-gallery", label: "Clothesline Gallery", slots: ["Photo 1", "Photo 2", "Photo 3", "Photo 4", "Photo 5"] },
  { value: "taped-scrapbook", label: "Taped Scrapbook", slots: ["Photo 1", "Photo 2", "Photo 3", "Photo 4"] },
  { value: "stacked-polaroids", label: "Stacked Polaroids", slots: ["Photo 1 (top)", "Photo 2", "Photo 3", "Photo 4"] },
  { value: "mixed-editorial", label: "Mixed Editorial", slots: ["Hero image", "Polaroid feature", "Full-width image", "Polaroid left", "Polaroid right", "End image"] },
];

export const TEMPLATE_MAP: Record<string, React.FC<{ content: string; bodyImages: string[]; bodyCaptions?: string[]; dropCapEnabled?: boolean }>> = {
  "clean-editorial": CleanEditorial,
  "single-polaroid": SinglePolaroid,
  "polaroid-pair": PolaroidPair,
  "polaroid-trio": PolaroidTrio,
  "clothesline-gallery": ClotheslineGallery,
  "taped-scrapbook": TapedScrapbook,
  "stacked-polaroids": StackedPolaroids,
  "mixed-editorial": MixedEditorial,
};
