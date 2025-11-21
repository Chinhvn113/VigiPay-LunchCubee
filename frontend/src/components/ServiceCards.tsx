import { Users, UserCog } from "lucide-react";

const services = [
  {
    icon: Users,
    label: "VCB Family",
    badge: "mới",
  },
  {
    icon: UserCog,
    label: "Quản lý nhóm",
    badge: "mới",
  },
];

export const ServiceCards = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">Mới nhất trên VCB Digibank</h3>
        <button className="text-sm text-primary hover:underline">Xem tất cả ưu đãi →</button>
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
