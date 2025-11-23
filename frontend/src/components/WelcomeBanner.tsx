import { useAuth } from "@/contexts/AuthContext";
import { User } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext"; 

export const WelcomeBanner = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const displayName = user?.full_name || user?.username || t('guest');
  
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="flex-shrink-0">
        {user?.avatar_url ? (
          <img 
            src={user.avatar_url} 
            alt={displayName}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-primary/20"
          />
        ) : (
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
            <span className="text-lg md:text-xl font-semibold text-primary">
              {avatarLetter}
            </span>
          </div>
        )}
      </div>
      
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          {t("welcomeBack")} <span className="text-primary">{displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("haveAGreatDay")}
        </p>
      </div>
    </div>
  );
};
