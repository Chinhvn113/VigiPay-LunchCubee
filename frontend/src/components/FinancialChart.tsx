import { TrendingDown } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

export const FinancialChart = () => {
  const { t } = useLanguage();
  const data = [
    { label: "T6", height: 40 },
    { label: "T7", height: 70 },
    { label: "T8", height: 50 },
    { label: "T9", height: 85 },
    { label: "T10", height: 60 },
    { label: "T11", height: 45 },
  ];

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6 gap-4">
        <h3 className="text-lg md:text-xl font-semibold text-foreground break-words">{t('personalFinance')}</h3>
        <Button className="bg-accent-green hover:bg-accent-green/90 text-accent-green-foreground whitespace-nowrap shrink-0 transition-all duration-300 hover:scale-105">
          {t('edit')}
        </Button>
      </div>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('expense')} vs {t('lastMonth')}</span>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-accent-green" />
            <span className="text-2xl font-bold text-accent-green">67%</span>
          </div>
        </div>
        
        {/* Chart */}
        <div className="flex items-end justify-between gap-3 h-32">
          {data.map((bar, index) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-t-lg bg-gradient-to-t from-chart-3 to-chart-2" 
                   style={{ height: `${bar.height}%` }} />
              <span className="text-xs text-muted-foreground">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
