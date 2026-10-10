import type { ComponentType } from "react";

interface HoverCardProps {
  title: string;
  description: string;
  /** A Lucide icon, or any component taking a className (e.g. NairaIcon). */
  icon: ComponentType<{ className?: string }>;
  index?: number;
}

const HoverCard = ({ title, description, icon: Icon, index = 0 }: HoverCardProps) => {
  return (
    <div 
      className={`group kit-curve bg-card p-6 border border-hairline-warm hover:border-brand transition-colors duration-300 animate-slide-up stagger-${Math.min(index + 1, 6)}`}
    >
      <div className="kit-curve-sm relative mb-5 flex h-11 w-11 items-center justify-center bg-tint transition-colors duration-300 group-hover:bg-brand">
        <Icon className="relative h-5 w-5 text-brand transition-colors duration-300 group-hover:text-white" />
      </div>
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink transition-colors group-hover:text-brand">{title}</h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-body">{description}</p>
    </div>
  );
};

export default HoverCard;
