import { Button } from "./ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

export const CreditCardPromo = () => {
  const { t } = useLanguage();
  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <h3 className="text-xl font-semibold text-foreground">{t('creditDebitCard')}</h3>
      
      <div className="relative glass-card rounded-xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-accent-green/30 overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 rounded bg-gradient-to-br from-yellow-400 to-yellow-600" />
            <div className="w-12 h-8 rounded bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              VISA
            </div>
            <div className="w-12 h-8 rounded bg-gradient-to-br from-red-500 to-orange-500" />
          </div>
          
          <div className="space-y-2">
            <p className="text-foreground font-medium">{t('interestFree45Days')}</p>
            <p className="text-foreground font-medium">{t('cashbackUpTo12')}</p>
          </div>
        </div>
        
        <div className="absolute right-0 bottom-0 w-48 h-32 opacity-30">
          <div className="w-full h-full bg-gradient-to-br from-yellow-600/30 to-transparent rounded-tl-full" />
        </div>
      </div>
      
      <Button className="w-full bg-accent-green hover:bg-accent-green/90 text-accent-green-foreground font-medium py-6 rounded-xl">
        {t('exploreNow')}
      </Button>
    </div>
  );
};
