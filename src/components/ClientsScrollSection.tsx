import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LucideIcon } from "lucide-react";
import FlipCard from "@/components/FlipCard";

interface ClientWithIcon {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface ClientWithFlipCard {
  title: string;
  description: string;
  icon: LucideIcon;
  backContent: string;
}

interface ClientsScrollSectionProps {
  clients: string[] | ClientWithIcon[] | ClientWithFlipCard[];
  useFlipCards?: boolean;
}

const isStringArray = (arr: any[]): arr is string[] => {
  return typeof arr[0] === 'string';
};

const hasBackContent = (arr: any[]): arr is ClientWithFlipCard[] => {
  return arr[0] && typeof arr[0] === 'object' && 'backContent' in arr[0];
};

const ClientsScrollSection = ({ clients, useFlipCards = false }: ClientsScrollSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-12">
      <div className="text-center mb-8 animate-slide-up">
        <h2 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.02em] text-ink">Our Clients</h2>
      </div>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 kit-curve-sm bg-white border border-hairline-warm flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pl-12 pr-12 pb-2 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {isStringArray(clients) ? (
            // Simple string clients - wide rectangle cards (no flip)
            clients.map((client, index) => (
              <div 
                key={client} 
                className={`group flex-shrink-0 w-64 h-24 md:w-80 md:h-28 p-4 md:p-5 kit-curve bg-card border border-hairline-warm hover:border-brand transition-all animate-slide-up stagger-${index + 1}`}
              >
                <div className="flex items-center justify-center h-full gap-3 text-center">
                  <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                  <span className="text-sm md:text-base font-medium">{client}</span>
                </div>
              </div>
            ))
          ) : useFlipCards && hasBackContent(clients) ? (
            // FlipCard clients - these flip on click
            clients.map((client, index) => (
              <div 
                key={client.title} 
                className={`flex-shrink-0 w-72 h-56 md:w-80 md:h-64 animate-slide-up stagger-${index + 1}`}
              >
                <FlipCard {...client} />
              </div>
            ))
          ) : (
            // Clients with icons - wide rectangle cards (no flip)
            (clients as ClientWithIcon[]).map((client, index) => {
              const Icon = client.icon;
              return (
                <div 
                  key={client.title} 
                  className={`group flex-shrink-0 w-72 h-28 md:w-96 md:h-36 p-4 md:p-6 kit-curve bg-card border border-hairline-warm hover:border-brand transition-all animate-slide-up stagger-${index + 1}`}
                >
                  <div className="flex items-center justify-center h-full gap-4 md:gap-5">
                    <div className="w-10 h-10 md:w-12 md:h-12 kit-curve-sm bg-tint flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <div className="text-center space-y-1 md:space-y-2">
                      <h3 className="font-semibold text-sm md:text-base">{client.title}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{client.description}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 kit-curve-sm bg-white border border-hairline-warm flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </section>
  );
};

export default ClientsScrollSection;
