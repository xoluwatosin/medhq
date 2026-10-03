import { LucideIcon, ArrowUpRight } from "lucide-react";
import { useState } from "react";

interface InteractiveCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  expandedContent?: string;
  href?: string;
}

const InteractiveCard = ({ title, description, icon: Icon, expandedContent, href }: InteractiveCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const CardContent = () => (
    <div className="flex flex-col h-full">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
        <Icon className="w-7 h-7" />
      </div>
      
      <h3 className="text-xl font-bold mb-3 group-hover:text-accent transition-colors">
        {title}
      </h3>
      
      <p className="text-muted-foreground text-sm leading-relaxed flex-grow">
        {description}
      </p>

      {expandedContent && (
        <div 
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isExpanded ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {expandedContent}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between mt-6">
        {expandedContent && !href && (
          <button 
            onClick={(e) => {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}
            className="text-sm font-medium text-accent hover:text-primary transition-colors"
          >
            {isExpanded ? 'Show Less' : 'Learn More'}
          </button>
        )}
        {href && (
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            Learn More
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="group relative block rounded-[2rem] overflow-hidden bg-card p-8 card-hover border border-border/50"
      >
        <CardContent />
      </a>
    );
  }

  return (
    <div
      className="group relative rounded-[2rem] overflow-hidden bg-card p-8 card-hover border border-border/50 cursor-pointer"
      onClick={() => expandedContent && setIsExpanded(!isExpanded)}
    >
      <CardContent />
    </div>
  );
};

export default InteractiveCard;
