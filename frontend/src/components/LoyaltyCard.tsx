import { Button } from "./ui/button";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export const LoyaltyCard = () => {
  const { t } = useLanguage();
  return (
    <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-purple-600/40 to-purple-800/40 border-purple-500/30">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">{t('vcbLoyalty')}</h3>
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl">
          🤑
        </div>
      </div>
      
      <p className="text-sm text-purple-200 mb-4">{t('accumulatedPoints')}</p>
      
      <div className="text-5xl font-bold text-foreground mb-6">900</div>
      
      <Button className="w-full bg-accent-green hover:bg-accent-green/90 text-accent-green-foreground font-medium py-6 rounded-xl">
        {t('redeemNow')}
      </Button>
      
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4" />
        <span>{t('updatedAt')}: 16.17 - 12/11/2025</span>
      </div>
    </div>
  );
};
