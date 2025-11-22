import { Users, UserCog } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export const ServiceCards = () => {
  const { t } = useLanguage();

  const services = [
    {
      icon: Users,
      label: t('vcbFamily'),
      badge: t('newBadge'),
    },
    {
      icon: UserCog,
      label: t('groupManagement'),
      badge: t('newBadge'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">{t('latestOnDigibank')}</h3>
        <button className="text-sm text-primary hover:underline">{t('viewAllOffers')} →</button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {services.map((service) => (
          <div
            key={service.label}
            className="glass-card glass-card-hover rounded-xl p-6 cursor-pointer flex items-center gap-4"
          >
            <div className="p-3 rounded-full bg-accent-green/20">
              <service.icon className="h-6 w-6 text-accent-green" />
            </div>
            <div className="flex-1">
              <span className="text-foreground font-medium">{service.label}</span>
              {service.badge && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {service.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
