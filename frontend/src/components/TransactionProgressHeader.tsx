import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface StepProps {
  stepNumber: number;
  label: string;
  currentStep: number;
}

const Step = ({ stepNumber, label, currentStep }: StepProps) => {
  const isActive = currentStep >= stepNumber;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium transition-colors duration-300 ${
        isActive ? 'bg-accent-green text-background' : 'bg-muted text-muted-foreground'
      }`}>
        {stepNumber}
      </div>
      <span className={`text-sm md:text-base transition-colors duration-300 ${
        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
      }`}>
        {label}
      </span>
    </div>
  );
};

/**
 * A 3-step progress header for the transaction flow.
 * @param currentStep - The current active step (1, 2, or 3).
 */
export const TransactionProgressHeader = ({ currentStep }: { currentStep: 1 | 2 | 3 }) => {
  const { t } = useLanguage();

  return (
    <div className="mb-6 md:mb-8 flex items-center gap-2 md:gap-4">
      <Step stepNumber={1} label={t('transfer') || 'Transfer'} currentStep={currentStep} />
      <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
      <Step stepNumber={2} label={t('safetyCheck') || 'Safety Check'} currentStep={currentStep} />
      <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
      <Step stepNumber={3} label={t('confirm') || 'Confirm'} currentStep={currentStep} />
    </div>
  );
};