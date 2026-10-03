import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

const StepIndicator = ({ currentStep, totalSteps, labels }: StepIndicatorProps) => {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className="space-y-4">
      <Progress value={progress} className="h-2 rounded-full" />
      <div className="flex justify-between">
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isComplete || isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {isComplete ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span className={`text-xs hidden sm:block ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
