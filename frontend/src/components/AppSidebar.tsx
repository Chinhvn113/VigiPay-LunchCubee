import { Home, Shield, Sparkles, ArrowLeftRight, Smartphone, TrendingUp, History} from "lucide-react";
import { NavLink } from "./NavLink";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/sidebar";

export const AppSidebar = () => {
  const { open, setOpen, isMobile } = useSidebar();
  const { t } = useLanguage();
  
  const navItems = [
    { icon: Home, labelKey: "home", path: "/" },
    { icon: Shield, labelKey: "safetyChecking", path: "/safety" },
    { icon: Sparkles, labelKey: "aiChatbot", path: "/chatbot" },
    { icon: ArrowLeftRight, labelKey: "transfer", path: "/transaction" },
    { icon: History, labelKey: "transactionHistory", path: "/transaction-history" },
    { icon: Smartphone, labelKey: "phoneTopup", path: "/phone-topup" },
    { icon: TrendingUp, labelKey: "financialManagement", path: "/financial-management" },
  ];

  const handleNavClick = (e: React.MouseEvent) => {
    // Mobile Logic: Close sidebar after navigation to clear the screen
    if (isMobile) {
      setOpen(false);
    }
    // Desktop: Allow navigation regardless of sidebar state
    // Don't expand sidebar when clicking menu items in icon mode
  };

  return (
    <Sidebar 
      // Enable "icon" mode for desktop to allow minimizing
      collapsible="icon"
      className="border-sidebar-border transition-all duration-300 z-20"
    >
      <SidebarHeader className="h-16 flex items-center justify-center px-6 border-sidebar-border">
        {open ? (
          <h1 className="text-xl font-bold truncate">
            <span className="text-primary">{t('appTitle')}</span>
          </h1>
        ) : (
          <h1 className="text-xl font-bold text-primary">{t('appTitleShort')}</h1>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        {/* Navigation */}
        <SidebarMenu className="px-2 pt-4 space-y-1">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton 
                asChild 
                tooltip={!open ? t(item.labelKey as any) : undefined} // Optional: Show tooltip when minimized
                className="transition-all duration-300"
              >
                <NavLink
                  to={item.path}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300",
                    // Layout adjustments based on Open/Closed state
                    open ? "gap-3 px-4 py-3 hover:translate-x-1" : "justify-center w-full py-3",
                    isMobile && "gap-3 px-4 py-3"
                  )}
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <item.icon className="shrink-0 h-5 w-5" />
                  
                  {/* Only show text when Expanded (open) OR on Mobile */}
                  {(open || isMobile) && (
                    <span className="whitespace-nowrap">
                      {t(item.labelKey as any)}
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};