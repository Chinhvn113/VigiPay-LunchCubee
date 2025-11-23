import { ReactNode, useState, useEffect } from "react";
import { Settings, Globe, LogOut, ArrowLeft, MessageSquare, X } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "./ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { VoiceCommandButton } from "./VoiceCommandButton";
import { Card, CardContent } from "./ui/card";
import backgroundImg from "./backgrounds/background1.png"; 

interface DashboardLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  fullHeight?: boolean;
}

const DashboardContent = ({ children, sidebar, navigate, location, isHomePage, fullHeight }: any) => {
  const { open, isMobile, setOpen } = useSidebar();
  const { logout, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  useEffect(() => {
    localStorage.setItem("sidebar:state", String(open));
  }, [open]);

  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [chatResult, setChatResult] = useState<{ user: string; bot: string } | null>(null);
  const [headerTranscript, setHeaderTranscript] = useState("");

  const handleVoiceCommandResult = (result: any) => {
    setHeaderTranscript("");
    
    if (!result) return;

    setChatResult(null);

    const payload = { ...result, ...(result.entities || {}) };
    
    console.log("Global Voice Payload:", payload); 

    if (payload.intent === 'transfer_money' || payload.intent === 'transaction') {
      sonnerToast.success(t('transferRequestDetected'));
      
      setTimeout(() => {
        navigate('/transaction', { 
          state: { 
            recipientAccount: payload.account_number || payload.recipient_account || payload.account || payload.recipientAccount,
            account_number: payload.account_number, 
            amount: payload.amount,
            description: payload.description || payload.reason
          } 
        });
      }, 100);
    } 
    else if (payload.intent === 'phone_topup') {
      sonnerToast.success(t('topupRequestDetected'));
      
      setTimeout(() => {
        navigate('/phone-topup', { 
          state: { 
            prefill: {
              phone_number: payload.phone_number || payload.phone,
              amount: payload.amount
            }
          } 
        });
      }, 100);
    } 
    else if (result.intent === 'general_chat') {
      const botReply = result.reply || t('botReplyDefault');
      const userTranscript = result.transcript || t('unknownCommand');
      
      setChatResult({
        user: userTranscript,
        bot: botReply
      });
    } 
    else {
      sonnerToast.warning(t('voiceCommandFailed'));
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      sonnerToast.success(t('loggedOut'));
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/login");
    }
  };

  const handleSettings = () => navigate("/settings");

  const handleOverlayClick = () => {
    if (isMobile) setOpen(false);
  };
  
  return (
    <>
      {sidebar}
      
      {isMobile && open && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in"
          onClick={handleOverlayClick}
        />
      )}
      
      {chatResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 border-primary/20">
            <div className="flex justify-between items-center p-4 border-b bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> 
                {t('assistant')}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatResult(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('youSaid')}</p>
                <p className="text-sm text-foreground italic">"{chatResult.user}"</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                  <span className="text-xs font-bold text-primary">AI</span>
                </div>
                <div className="space-y-1 pt-1">
                  <p className="text-sm leading-relaxed">{chatResult.bot}</p>
                </div>
              </div>
              <Button className="w-full mt-4" onClick={() => setChatResult(null)}>
                {t('close')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none select-none">
          <img 
            src={backgroundImg} 
            alt="" 
            className="w-full h-full object-cover opacity-100"
          />
          <div className="absolute inset-0 bg-background/30 backdrop-blur-[2px]" />
      </div>

      <div className="flex-1 flex flex-col w-full transition-all duration-300 relative bg-transparent">
        <header 
          style={{
            left: isMobile ? 0 : (open ? 'var(--sidebar-width, 14rem)' : 'var(--sidebar-width-icon, 3.5rem)')
          }}
          className="fixed top-0 z-50 h-16 flex items-center justify-between px-4 md:px-8 backdrop-blur-md bg-background/80 border-b border-border/30 shadow-sm transition-[left,right] duration-200 ease-linear right-0"
        >
          <div className="flex items-center gap-2">
            <SidebarTrigger className="transition-all duration-300 hover:scale-110" />
            {!isHomePage && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-sidebar-foreground hover:text-primary gap-2 transition-all duration-300"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t('backToHome')}</span>
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 relative">
            
            {headerTranscript && (
              <div 
                className="absolute top-14 right-0 w-64 p-3 bg-background/90 border border-primary/20 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 hidden sm:block"
              >
                <p className="text-xs font-semibold text-primary mb-0.5">{t('listening')}</p>
                <p className="text-sm text-foreground italic line-clamp-2">"{headerTranscript}"</p>
              </div>
            )}
            <VoiceCommandButton
              onSuccess={handleVoiceCommandResult}
              onProcessing={setIsVoiceProcessing}
               onTranscript={setHeaderTranscript}
              disabled={isVoiceProcessing}
              size="sm"
              className="gap-2"
            >
              {isVoiceProcessing ? t('processing') : t('useVoice')}
            </VoiceCommandButton>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar_url || ""} alt={user?.username || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.username?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.username || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email || ""}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t('settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>{t('language')}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                      <DropdownMenuRadioItem value="vi">Tiếng Việt</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        {fullHeight ? (
          <main className="flex-1 flex flex-col min-h-0 relative z-10 pt-16">
            {children}
          </main>
        ) : (
          <main className="flex-1 relative z-10 pt-16">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        )}
      </div>
    </>
  );
};

export const DashboardLayout = ({ children, sidebar, fullHeight = false }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  const [defaultOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem("sidebar:state");
      if (savedState !== null) return savedState === "true";
      return window.innerWidth >= 768;
    }
    return true;
  });
  
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="flex min-h-screen w-full bg-transparent">
        <DashboardContent 
          sidebar={sidebar}
          navigate={navigate}
          location={location}
          isHomePage={isHomePage}
          fullHeight={fullHeight}
        >
          {children}
        </DashboardContent>
      </div>
    </SidebarProvider>
  );
};