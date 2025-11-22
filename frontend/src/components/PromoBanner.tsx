import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

export const PromoBanner = () => {
  const { t } = useLanguage();
  return (
    <div className="glass-card rounded-2xl overflow-hidden relative h-64">
      {/* Placeholder for banner image */}
      <div className="w-full h-full bg-gradient-to-br from-blue-500/40 to-cyan-500/40 flex items-center justify-center">
        <div className="text-center text-foreground p-8">
          <h3 className="text-2xl font-bold mb-2">{t('specialOffer')}</h3>
          <p className="text-muted-foreground">{t('explorePromotions')}</p>
        </div>
      </div>
      
      {/* Navigation */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 backdrop-blur-sm hover:bg-background/40"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 backdrop-blur-sm hover:bg-background/40"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );
};
