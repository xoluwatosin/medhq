import { useEffect, useState } from "react";

interface StatsCardProps {
  value: string;
  label: string;
  suffix?: string;
  delay?: number;
}

const StatsCard = ({ value, label, suffix = "", delay = 0 }: StatsCardProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = parseInt(value.replace(/\D/g, ''), 10);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const increment = numericValue / 40;
      const animate = () => {
        start += increment;
        if (start < numericValue) {
          setDisplayValue(Math.floor(start));
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(numericValue);
        }
      };
      animate();
    }, delay);
    
    return () => clearTimeout(timer);
  }, [numericValue, delay]);

  return (
    <div className="text-center p-6 rounded-2xl bg-card border border-border/50 hover:scale-105 transition-transform duration-300">
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
        {displayValue}{suffix}
      </div>
      <p className="text-muted-foreground font-medium">{label}</p>
    </div>
  );
};

export default StatsCard;
