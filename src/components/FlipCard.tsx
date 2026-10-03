import { LucideIcon, Hand } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface FlipCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  backContent?: string;
}

const FlipCard = ({ title, description, icon: Icon, backContent }: FlipCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div 
      className={`flip-card-container cursor-pointer ${isMobile ? 'h-44' : 'h-56'}`}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
        {/* Front */}
        <div className={`flip-card-front bg-card border border-hairline-warm flex flex-col h-full kit-curve ${isMobile ? 'p-4' : 'p-6'}`}>
          <div className={`kit-curve-sm bg-tint flex items-center justify-center ${isMobile ? 'w-10 h-10 mb-2' : 'w-14 h-14 mb-4'}`}>
            <Icon className={isMobile ? 'w-5 h-5' : 'w-7 h-7'} />
          </div>
          <h3 className={`font-semibold tracking-[-0.01em] ${isMobile ? 'text-sm mb-1' : 'text-xl mb-2'}`}>{title}</h3>
          <p className={`text-muted-foreground leading-relaxed ${isMobile ? 'text-xs line-clamp-2' : 'text-sm line-clamp-2'}`}>{description}</p>
          <div className={`mt-auto flex items-center justify-between ${isMobile ? 'pt-2' : 'pt-3'}`}>
            <span className={`text-accent-foreground/60 font-medium ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Tap to learn more →</span>
            {isMobile && backContent && <Hand className="w-4 h-4 text-muted-foreground/40" />}
          </div>
        </div>
        
        {/* Back */}
        <div className={`flip-card-back bg-navy text-white flex flex-col justify-center h-full kit-curve ${isMobile ? 'p-4' : 'p-6'}`}>
          <h3 className={`font-semibold tracking-[-0.01em] ${isMobile ? 'text-base mb-2' : 'text-xl mb-3'}`}>{title}</h3>
          <p className={`leading-relaxed opacity-90 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {backContent || description}
          </p>
          <div className={`mt-auto ${isMobile ? 'pt-2' : 'pt-3'}`}>
            <span className={`font-medium opacity-75 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Tap to go back</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlipCard;
