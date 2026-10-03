import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LucideIcon } from "lucide-react";

interface AccordionItemData {
  title: string;
  content: string;
  icon?: LucideIcon;
}

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  items: AccordionItemData[];
  defaultOpen?: string;
}

const AccordionSection = ({ title, subtitle, items, defaultOpen }: AccordionSectionProps) => {
  return (
    <section className="py-16">
      <div className="text-center mb-12 animate-slide-up">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">{title}</h2>
        {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="max-w-3xl mx-auto rounded-[2rem] bg-card p-6 md:p-8 border border-border/50 animate-slide-up">
        <Accordion type="single" collapsible defaultValue={defaultOpen}>
          {items.map((item, index) => (
            <AccordionItem 
              key={item.title} 
              value={`item-${index}`}
              className="border-border/50"
            >
              <AccordionTrigger className="hover:no-underline py-4 text-left">
                <div className="flex items-center gap-3">
                  {item.icon && (
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5" />
                    </div>
                  )}
                  <span className="font-semibold">{item.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-4 pl-13">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default AccordionSection;
