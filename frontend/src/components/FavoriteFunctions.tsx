import { Smartphone, Send, Wallet, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export const FavoriteFunctions = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const functions = [
    { icon: Send, labelKey: "transferMoney", color: "text-sky-400", path: "/transaction" },
    { icon: Sparkles, labelKey: "chatWithSentinel", color: "text-purple-400", path: "/chatbot" },
    { icon: ShieldCheck, labelKey: "safetyCheck", color: "text-emerald-400", path: "/safety" },
    { icon: Phone, labelKey: "topupPhone", color: "text-blue-400", path: "/phone-topup" },
    { icon: Wallet, labelKey: "personalFinance", color: "text-amber-400", path: "/financial-management" },
  ];

  return (
    <div className="mb-8 animate-fade-in">
      <h2 className="text-lg font-semibold mb-4 text-foreground drop-shadow-md px-1">
        {t('favoritesFunctions')}
      </h2>
      
      {/* CONTAINER: Solid Dark Color (No Blur, No Transparency) */}
      <div className="
        w-full p-6 rounded-2xl
        bg-slate-900 
        border border-slate-800
        shadow-xl
      ">
        <div className="grid grid-cols-5 gap-2 place-items-center">
          {functions.map((func) => (
            <Button
              key={func.labelKey}
              variant="ghost"
              onClick={() => navigate(func.path)}
              className="h-auto w-full flex flex-col items-center justify-start gap-3 p-0 hover:bg-transparent border-0 shadow-none group relative"
            >
              {/* ICON CIRCLE: Solid Lighter Color */}
              <div className="
                w-14 h-14 md:w-16 md:h-16 rounded-full 
                bg-slate-800
                border border-slate-700
                shadow-md
                flex items-center justify-center 
                transition-all duration-300 
                group-hover:bg-slate-700
                group-hover:border-slate-600 
                group-hover:-translate-y-1 group-hover:shadow-lg
                group-active:scale-95 group-active:translate-y-0
              ">
                {/* Sharp Icon */}
                <func.icon className={`h-6 w-6 md:h-7 md:w-7 stroke-2 ${func.color}`} />
              </div>
              
              {/* Bright Solid Text */}
              <span className="text-[11px] md:text-xs font-medium text-center text-gray-200 group-hover:text-white transition-colors leading-tight w-full px-0.5 whitespace-normal line-clamp-2">
                {t(func.labelKey as any)}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};